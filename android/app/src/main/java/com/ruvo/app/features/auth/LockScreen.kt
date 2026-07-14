package com.ruvo.app.features.auth

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.ruvo.app.designsystem.theme.RuvoColors

@Composable
fun LockScreen(onUnlocked: () -> Unit) {
    val context = LocalContext.current
    var lockState by remember { mutableStateOf(LockState.Waiting) }

    val biometricManager = remember { BiometricManager.from(context) }
    val canUseBiometrics = remember {
        biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    // Trigger biometric on first composition
    LaunchedEffect(Unit) {
        if (canUseBiometrics) {
            triggerBiometric(context, onSuccess = onUnlocked, onError = { lockState = LockState.Failed })
        } else {
            // No biometrics available — unlock directly
            onUnlocked()
        }
    }

    // Ripple animation
    val infiniteTransition = rememberInfiniteTransition(label = "ripple")
    val ripple1Scale by infiniteTransition.animateFloat(
        initialValue = 0.8f, targetValue = 1.6f,
        animationSpec = infiniteRepeatable(tween(1800, easing = EaseOut), RepeatMode.Restart),
        label = "r1"
    )
    val ripple2Scale by infiniteTransition.animateFloat(
        initialValue = 0.8f, targetValue = 1.6f,
        animationSpec = infiniteRepeatable(tween(1800, 600, easing = EaseOut), RepeatMode.Restart),
        label = "r2"
    )
    val ripple3Scale by infiniteTransition.animateFloat(
        initialValue = 0.8f, targetValue = 1.6f,
        animationSpec = infiniteRepeatable(tween(1800, 1200, easing = EaseOut), RepeatMode.Restart),
        label = "r3"
    )
    val rippleAlpha by infiniteTransition.animateFloat(
        initialValue = 0.5f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(1800, easing = EaseOut), RepeatMode.Restart),
        label = "alpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(32.dp),
        ) {
            Text(
                "RUVO",
                fontSize = 38.sp,
                fontWeight = FontWeight.ExtraBold,
                color = RuvoColors.lime,
                letterSpacing = 4.sp,
            )

            // Ripple rings + fingerprint icon
            Box(contentAlignment = Alignment.Center) {
                // Outer ripples
                listOf(ripple1Scale to 0.18f, ripple2Scale to 0.13f, ripple3Scale to 0.08f).forEach { (scale, alpha) ->
                    Box(
                        modifier = Modifier
                            .size(140.dp)
                            .scale(scale)
                            .alpha(rippleAlpha * (alpha / 0.18f))
                            .background(RuvoColors.lime.copy(alpha = alpha), CircleShape)
                    )
                }

                // Core circle
                Box(
                    modifier = Modifier
                        .size(90.dp)
                        .background(RuvoColors.surface, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.Fingerprint,
                        contentDescription = "Fingerprint",
                        tint = RuvoColors.lime,
                        modifier = Modifier.size(52.dp),
                    )
                }
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    when (lockState) {
                        LockState.Waiting -> "Tap to unlock"
                        LockState.Failed  -> "Try again"
                    },
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = RuvoColors.textPrimary,
                )
                Text(
                    "Use biometrics or device PIN to continue",
                    style = MaterialTheme.typography.bodyMedium,
                    color = RuvoColors.textSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 40.dp),
                )
            }

            TextButton(
                onClick = {
                    lockState = LockState.Waiting
                    triggerBiometric(context, onSuccess = onUnlocked, onError = { lockState = LockState.Failed })
                }
            ) {
                Text(
                    if (lockState == LockState.Failed) "Retry" else "Unlock with Biometrics",
                    color = RuvoColors.lime,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private enum class LockState { Waiting, Failed }

private fun triggerBiometric(
    context: android.content.Context,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
) {
    val activity = context as? FragmentActivity ?: return
    val executor = ContextCompat.getMainExecutor(context)
    val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            onSuccess()
        }
        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            onError(errString.toString())
        }
        override fun onAuthenticationFailed() {
            onError("Authentication failed")
        }
    })

    val info = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock RUVO")
        .setSubtitle("Use your biometrics or device PIN")
        .setAllowedAuthenticators(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        .build()

    prompt.authenticate(info)
}
