package com.ruvo.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ruvo.app.designsystem.theme.RuvoTheme
import com.ruvo.app.features.auth.AuthViewModel
import com.ruvo.app.ui.RuvoApp
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    // singleTop means an already-running instance gets onNewIntent(), not a fresh
    // onCreate() — this state is what lets a tapped live-share link navigate even
    // when the app was already open (see AndroidManifest.xml's "live" deep link).
    private var deepLinkLiveRunId = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        deepLinkLiveRunId.value = extractLiveRunId(intent)
        setContent {
            RuvoTheme {
                RuvoApp(deepLinkLiveRunId = deepLinkLiveRunId.value)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        extractLiveRunId(intent)?.let { deepLinkLiveRunId.value = it }
    }

    private fun extractLiveRunId(intent: Intent?): String? =
        intent?.data?.takeIf { it.host == "live" }?.lastPathSegment
}
