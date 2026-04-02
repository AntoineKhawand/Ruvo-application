import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

WebBrowser.maybeCompleteAuthSession();

const WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || 'your_whoop_client_id';
const WHOOP_CLIENT_SECRET = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET || 'your_whoop_client_secret';
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

class WhoopService {
  constructor() {
    this.redirectUri = AuthSession.makeRedirectUri({
      scheme: 'ruvoapplication'
    });
  }

  async authenticate() {
    try {
      const authRequest = new AuthSession.AuthRequest({
        clientId: WHOOP_CLIENT_ID,
        scopes: ['read:recovery', 'read:sleep', 'read:workout', 'read:cycles', 'read:body_measurement'],
        redirectUri: this.redirectUri,
        responseType: AuthSession.ResponseType.Code,
      });

      const result = await authRequest.promptAsync({
        authorizationEndpoint: WHOOP_AUTH_URL
      });

      if (result.type === 'success') {
        const { code } = result.params;
        const token = await this.exchangeCodeForToken(code);
        if (token) {
            await this.syncToCloud(token);
            return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[WhoopService] Authentication failed', error);
      return false;
    }
  }

  async exchangeCodeForToken(code) {
    try {
        const bodyStr = `grant_type=authorization_code&code=${code}&client_id=${WHOOP_CLIENT_ID}&client_secret=${WHOOP_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
        
        const response = await fetch(WHOOP_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyStr
        });

        const data = await response.json();
        
        if (data.access_token) {
            await SecureStore.setItemAsync('whoop_access_token', data.access_token);
            if (data.refresh_token) {
                await SecureStore.setItemAsync('whoop_refresh_token', data.refresh_token);
            }
            return data.access_token;
        } else {
            console.error('[WhoopService] Token Exchange Failed', data);
            return null;
        }
    } catch (e) {
        console.error('[WhoopService] Token Exchange Request Error', e);
        return null;
    }
  }

  async getAccessToken() {
    return await SecureStore.getItemAsync('whoop_access_token');
  }
  
  async disconnect() {
      await SecureStore.deleteItemAsync('whoop_access_token');
      await SecureStore.deleteItemAsync('whoop_refresh_token');
      return true;
  }

  async syncToCloud(passedToken = null) {
      const token = passedToken || await this.getAccessToken();
      if (!token) return false;

      try {
          const syncFn = httpsCallable(functions, 'syncWhoopData');
          const res = await syncFn({ accessToken: token });
          return !!res.data?.success;
      } catch (error) {
          console.error('[WhoopService] Cloud Sync Failed', error);
          return false;
      }
  }
}

export const whoopService = new WhoopService();
