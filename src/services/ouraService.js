import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Deferred to avoid crashing at module load time in production builds.
// maybeCompleteAuthSession must run after the JS bridge is fully ready.
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  console.warn('[OuraService] maybeCompleteAuthSession failed:', e.message);
}

const OURA_CLIENT_ID = process.env.EXPO_PUBLIC_OURA_CLIENT_ID || 'your_oura_client_id';
const OURA_CLIENT_SECRET = process.env.EXPO_PUBLIC_OURA_CLIENT_SECRET || 'your_oura_client_secret';
const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';

class OuraService {
  constructor() {
    this.redirectUri = AuthSession.makeRedirectUri({
      scheme: 'ruvoapplication'
    });
  }

  async authenticate() {
    try {
      const authRequest = new AuthSession.AuthRequest({
        clientId: OURA_CLIENT_ID,
        scopes: ['daily', 'heartrate', 'personal', 'session', 'sleep'],
        redirectUri: this.redirectUri,
        responseType: AuthSession.ResponseType.Code,
      });

      const result = await authRequest.promptAsync({
        authorizationEndpoint: OURA_AUTH_URL
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
      console.error('[OuraService] Authentication failed', error);
      return false;
    }
  }

  async exchangeCodeForToken(code) {
    try {
        const bodyStr = `grant_type=authorization_code&code=${code}&client_id=${OURA_CLIENT_ID}&client_secret=${OURA_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
        
        const response = await fetch(OURA_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyStr
        });

        const data = await response.json();
        
        if (data.access_token) {
            await SecureStore.setItemAsync('oura_access_token', data.access_token);
            if (data.refresh_token) {
                await SecureStore.setItemAsync('oura_refresh_token', data.refresh_token);
            }
            return data.access_token;
        } else {
            console.error('[OuraService] Token Exchange Failed', data);
            return null;
        }
    } catch (e) {
        console.error('[OuraService] Token Exchange Request Error', e);
        return null;
    }
  }

  async getAccessToken() {
    return await SecureStore.getItemAsync('oura_access_token');
  }
  
  async disconnect() {
      await SecureStore.deleteItemAsync('oura_access_token');
      await SecureStore.deleteItemAsync('oura_refresh_token');
      return true;
  }

  async syncToCloud(passedToken = null) {
      const token = passedToken || await this.getAccessToken();
      if (!token) return false;

      try {
          const syncFn = httpsCallable(functions, 'syncOuraData');
          const res = await syncFn({ accessToken: token });
          return !!res.data?.success;
      } catch (error) {
          console.error('[OuraService] Cloud Sync Failed', error);
          return false;
      }
  }
}

export const ouraService = new OuraService();

