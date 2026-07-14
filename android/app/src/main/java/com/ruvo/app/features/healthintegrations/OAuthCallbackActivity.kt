package com.ruvo.app.features.healthintegrations

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.ruvo.app.BuildConfig
import androidx.lifecycle.lifecycleScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class OAuthCallbackActivity : AppCompatActivity() {

    @Inject lateinit var auth: FirebaseAuth
    @Inject lateinit var firestore: FirebaseFirestore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        val uri = intent.data ?: run { finish(); return }
        val code = uri.getQueryParameter("code") ?: run { finish(); return }

        when {
            uri.toString().startsWith("com.ruvo.app://oauth/oura")  -> exchangeOura(code)
            uri.toString().startsWith("com.ruvo.app://oauth/whoop") -> exchangeWhoop(code)
            else -> finish()
        }
    }

    private fun exchangeOura(code: String) {
        lifecycleScope.launch {
            try {
                val tokens = withContext(Dispatchers.IO) {
                    val client = OkHttpClient()
                    val body = FormBody.Builder()
                        .add("grant_type", "authorization_code")
                        .add("code", code)
                        .add("client_id", BuildConfig.OURA_CLIENT_ID)
                        .add("redirect_uri", "com.ruvo.app://oauth/oura")
                        .build()
                    val req = Request.Builder()
                        .url("https://api.ouraring.com/oauth/token")
                        .post(body)
                        .build()
                    val resp = client.newCall(req).execute()
                    JSONObject(resp.body?.string() ?: "{}")
                }
                saveOuraTokens(tokens)
            } catch (_: Exception) {}
            finish()
        }
    }

    private fun exchangeWhoop(code: String) {
        lifecycleScope.launch {
            try {
                val tokens = withContext(Dispatchers.IO) {
                    val client = OkHttpClient()
                    val body = FormBody.Builder()
                        .add("grant_type", "authorization_code")
                        .add("code", code)
                        .add("client_id", BuildConfig.WHOOP_CLIENT_ID)
                        .add("redirect_uri", "com.ruvo.app://oauth/whoop")
                        .build()
                    val req = Request.Builder()
                        .url("https://api.prod.whoop.com/oauth/oauth2/token")
                        .post(body)
                        .build()
                    val resp = client.newCall(req).execute()
                    JSONObject(resp.body?.string() ?: "{}")
                }
                saveWhoopTokens(tokens)
            } catch (_: Exception) {}
            finish()
        }
    }

    private suspend fun saveOuraTokens(json: JSONObject) {
        val uid = auth.currentUser?.uid ?: return
        val updates = buildMap<String, Any> {
            json.optString("access_token").takeIf { it.isNotEmpty() }?.let { put("oura_access_token", it) }
            json.optString("refresh_token").takeIf { it.isNotEmpty() }?.let { put("oura_refresh_token", it) }
        }
        if (updates.isNotEmpty()) {
            firestore.collection("users").document(uid)
                .collection("integrations").document("oauth")
                .set(updates, com.google.firebase.firestore.SetOptions.merge()).await()
        }
    }

    private suspend fun saveWhoopTokens(json: JSONObject) {
        val uid = auth.currentUser?.uid ?: return
        val updates = buildMap<String, Any> {
            json.optString("access_token").takeIf { it.isNotEmpty() }?.let { put("whoop_access_token", it) }
            json.optString("refresh_token").takeIf { it.isNotEmpty() }?.let { put("whoop_refresh_token", it) }
        }
        if (updates.isNotEmpty()) {
            firestore.collection("users").document(uid)
                .collection("integrations").document("oauth")
                .set(updates, com.google.firebase.firestore.SetOptions.merge()).await()
        }
    }
}
