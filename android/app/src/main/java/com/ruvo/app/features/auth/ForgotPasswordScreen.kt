package com.ruvo.app.features.auth

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.FirebaseAuth
import com.ruvo.app.designsystem.components.RuvoButton
import com.ruvo.app.designsystem.theme.RuvoColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ForgotPasswordScreen(onBack: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var cooldown by remember { mutableIntStateOf(0) }
    var successSent by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(cooldown) {
        if (cooldown > 0) {
            delay(1000)
            cooldown--
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        IconButton(onClick = onBack, modifier = Modifier.align(Alignment.Start)) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
        }

        Spacer(Modifier.height(16.dp))

        Text("🔑", fontSize = 52.sp)
        Spacer(Modifier.height(12.dp))
        Text("Reset Password", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold, color = RuvoColors.textPrimary)
        Spacer(Modifier.height(8.dp))
        Text(
            "Enter your email and we'll send you a reset link.",
            style = MaterialTheme.typography.bodyMedium,
            color = RuvoColors.textSecondary,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(32.dp))

        if (successSent) {
            Surface(shape = RoundedCornerShape(16.dp), color = RuvoColors.lime.copy(alpha = 0.12f)) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RuvoColors.lime)
                    Column {
                        Text("Check your inbox!", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = RuvoColors.lime)
                        Text("If an account exists for $email, a reset link was sent.", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textSecondary)
                    }
                }
            }
        } else {
            OutlinedTextField(
                value = email,
                onValueChange = { email = it; errorMsg = "" },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Email address") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = RuvoColors.textTertiary) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = RuvoColors.lime,
                    unfocusedBorderColor = RuvoColors.border,
                    focusedLabelColor = RuvoColors.lime,
                    focusedContainerColor = RuvoColors.surfaceElev,
                    unfocusedContainerColor = RuvoColors.surfaceElev,
                    focusedTextColor = RuvoColors.textPrimary,
                    unfocusedTextColor = RuvoColors.textPrimary,
                ),
            )

            AnimatedVisibility(visible = errorMsg.isNotBlank()) {
                Text(errorMsg, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp))
            }
        }

        Spacer(Modifier.height(24.dp))

        if (!successSent) {
            RuvoButton(
                text = when {
                    isLoading -> "Sending…"
                    cooldown > 0 -> "Resend in ${cooldown}s"
                    else -> "Send Reset Link"
                },
                onClick = {
                    if (email.isBlank()) { errorMsg = "Please enter your email"; return@RuvoButton }
                    if (cooldown > 0) return@RuvoButton
                    isLoading = true; errorMsg = ""
                    scope.launch {
                        try {
                            FirebaseAuth.getInstance().sendPasswordResetEmail(email.trim().lowercase())
                            successSent = true
                            cooldown = 60
                        } catch (e: Exception) {
                            errorMsg = when {
                                e.message?.contains("invalid-email") == true -> "Please enter a valid email address."
                                e.message?.contains("too-many-requests") == true -> "Too many attempts. Try again later."
                                else -> "Could not send reset link. Try again."
                            }
                        } finally {
                            isLoading = false
                        }
                    }
                },
                enabled = !isLoading && cooldown == 0,
            )
        }

        if (successSent && cooldown > 0) {
            TextButton(onClick = {}) {
                Text("Resend in ${cooldown}s", color = RuvoColors.textTertiary)
            }
        }
        if (successSent && cooldown == 0) {
            TextButton(onClick = { successSent = false }) {
                Text("Resend link", color = RuvoColors.lime)
            }
        }

        Spacer(Modifier.height(16.dp))
        TextButton(onClick = onBack) {
            Text("Back to Sign In", color = RuvoColors.textSecondary)
        }
    }
}
