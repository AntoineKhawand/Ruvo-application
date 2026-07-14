package com.ruvo.app.features.auth

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ruvo.app.R
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*

// MARK: – Landing / Welcome screen
@Composable
fun LandingScreen(
    onGetStarted: () -> Unit,
    onSignIn: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        // Background: placeholder gradient until a runner photo is dropped into res/drawable/ and
        // this is swapped back to Image(painterResource(R.drawable.bg_welcome), ...). painterResource
        // only supports VectorDrawables and rasterized images, not <shape> drawables, so bg_welcome.xml
        // (a GradientDrawable) can't be loaded that way.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF0A1A0A), Color(0xFF0F1F0F), Color(0xFF050505)),
                    )
                )
        )

        // Dark overlay matching React Native rgba(0,0,0,0.4)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0x66000000))
        )

        // Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp)
                .padding(bottom = 60.dp),
        ) {
            // Logo top-left
            Spacer(modifier = Modifier.height(48.dp))
            Text(
                text = "RUVO",
                fontSize = 32.sp,
                fontWeight = FontWeight.ExtraBold,
                color = RuvoColors.lime,
                letterSpacing = 3.sp,
            )

            Spacer(modifier = Modifier.weight(1f))

            // Bottom text section
            Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                Text(
                    text = "Take Control of\nYour Running Journey",
                    fontSize = 31.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                    lineHeight = 40.sp,
                )
                Spacer(modifier = Modifier.height(15.dp))
                Text(
                    text = "Track your progress, set new challenges, and conquer your goals with ease.",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Normal,
                    color = Color(0xFFEEEEEE),
                    lineHeight = 24.sp,
                )
                Spacer(modifier = Modifier.height(30.dp))

                // Start Journey button
                Button(
                    onClick = onGetStarted,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(40.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = RuvoColors.lime,
                        contentColor = Color(0xFF121212),
                    ),
                ) {
                    Text(
                        text = "Start Journey",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Already have an account
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onSignIn)
                        .padding(10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = buildAnnotatedString {
                            withStyle(SpanStyle(color = Color(0xFFEEEEEE), fontSize = 14.sp)) {
                                append("Already have an account? ")
                            }
                            withStyle(SpanStyle(color = RuvoColors.lime, fontWeight = FontWeight.Bold, fontSize = 14.sp)) {
                                append("Log In")
                            }
                        },
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

// MARK: – Login Screen
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showForgotPassword by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }

    val uiState by viewModel.uiState.collectAsState()
    val isLoading = uiState is AuthUiState.Loading
    val errorMessage = (uiState as? AuthUiState.Error)?.message

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Welcome Back", style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary)
            Text("Sign in to continue your streak", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }

        RuvoTextField(value = email, onValueChange = { email = it }, label = "Email", icon = Icons.Default.Email, keyboardType = KeyboardType.Email)
        RuvoTextField(
            value = password,
            onValueChange = { password = it },
            label = "Password",
            icon = Icons.Default.Lock,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                        contentDescription = "Toggle visibility",
                        tint = RuvoColors.textTertiary
                    )
                }
            }
        )

        AnimatedVisibility(visible = errorMessage != null) {
            Text(errorMessage ?: "", style = MaterialTheme.typography.bodySmall, color = RuvoColors.error)
        }

        TextButton(
            onClick = { showForgotPassword = true },
            modifier = Modifier.align(Alignment.End)
        ) {
            Text("Forgot Password?", color = RuvoColors.lime)
        }

        RuvoButton(
            text = "Sign In",
            onClick = { viewModel.signInWithEmail(email, password) },
            isLoading = isLoading
        )

        AuthDivider()
        GoogleSignInButton(onGoogleSignIn = viewModel::signInWithGoogle)
    }

    if (showForgotPassword) {
        ForgotPasswordDialog(
            onDismiss = { showForgotPassword = false },
            onSend = { viewModel.sendPasswordReset(it) }
        )
    }
}

// MARK: – Sign Up Screen
@Composable
fun SignUpScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
) {
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    val uiState by viewModel.uiState.collectAsState()
    val isLoading = uiState is AuthUiState.Loading
    val errorMessage = (uiState as? AuthUiState.Error)?.message

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        IconButton(onClick = onBack) {
            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = RuvoColors.textPrimary)
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Create Account", style = MaterialTheme.typography.headlineLarge, color = RuvoColors.textPrimary)
            Text("Join millions of runners worldwide", style = MaterialTheme.typography.bodyLarge, color = RuvoColors.textSecondary)
        }

        RuvoTextField(value = displayName, onValueChange = { displayName = it }, label = "Full Name", icon = Icons.Default.Person)
        RuvoTextField(value = email, onValueChange = { email = it }, label = "Email", icon = Icons.Default.Email, keyboardType = KeyboardType.Email)
        RuvoTextField(
            value = password,
            onValueChange = { password = it },
            label = "Password",
            icon = Icons.Default.Lock,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            errorMessage = if (password.isNotEmpty() && password.length < 8) "Minimum 8 characters" else null
        )
        RuvoTextField(
            value = confirmPassword,
            onValueChange = { confirmPassword = it },
            label = "Confirm Password",
            icon = Icons.Default.LockOpen,
            visualTransformation = PasswordVisualTransformation(),
            errorMessage = if (confirmPassword.isNotEmpty() && password != confirmPassword) "Passwords don't match" else null
        )

        AnimatedVisibility(visible = errorMessage != null) {
            Text(errorMessage ?: "", style = MaterialTheme.typography.bodySmall, color = RuvoColors.error)
        }

        RuvoButton(
            text = "Create Account",
            onClick = { viewModel.signUpWithEmail(email, password, displayName) },
            isLoading = isLoading,
            enabled = displayName.isNotBlank() && email.isNotBlank() && password.length >= 8 && password == confirmPassword
        )

        AuthDivider()
        GoogleSignInButton(onGoogleSignIn = viewModel::signInWithGoogle)

        Text(
            text = "By continuing, you agree to our Terms of Service and Privacy Policy.",
            style = MaterialTheme.typography.bodySmall,
            color = RuvoColors.textTertiary,
        )
    }
}

// MARK: – Shared components
@Composable
fun AuthDivider() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Divider(modifier = Modifier.weight(1f), color = RuvoColors.border)
        Text("or", style = MaterialTheme.typography.bodySmall, color = RuvoColors.textTertiary)
        Divider(modifier = Modifier.weight(1f), color = RuvoColors.border)
    }
}

@Composable
fun GoogleSignInButton(onGoogleSignIn: (String) -> Unit) {
    // Google One Tap / Credential Manager integration triggers from Activity,
    // this button fires the callback. Credential result piped via Activity result.
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(CircleShape)
            .clickable { /* trigger Google Sign-In from Activity */ },
        shape = CircleShape,
        color = RuvoColors.surfaceElev,
        border = BorderStroke(1.dp, RuvoColors.border)
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Spacer(modifier = Modifier.width(8.dp))
            Text("Continue with Google", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textPrimary)
        }
    }
}

@Composable
fun RuvoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingIcon: @Composable (() -> Unit)? = null,
    errorMessage: String? = null,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            leadingIcon = if (icon != null) ({
                Icon(icon, contentDescription = null, tint = RuvoColors.textTertiary, modifier = Modifier.size(20.dp))
            }) else null,
            trailingIcon = trailingIcon,
            visualTransformation = visualTransformation,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
            isError = errorMessage != null,
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = RuvoColors.surfaceElev,
                unfocusedContainerColor = RuvoColors.surfaceElev,
                focusedBorderColor = RuvoColors.lime,
                unfocusedBorderColor = RuvoColors.border,
                focusedLabelColor = RuvoColors.lime,
                unfocusedLabelColor = RuvoColors.textTertiary,
                focusedTextColor = RuvoColors.textPrimary,
                unfocusedTextColor = RuvoColors.textPrimary,
                errorBorderColor = RuvoColors.error,
                errorLabelColor = RuvoColors.error,
            )
        )
        AnimatedVisibility(visible = errorMessage != null) {
            Text(errorMessage ?: "", style = MaterialTheme.typography.bodySmall, color = RuvoColors.error)
        }
    }
}

@Composable
fun ForgotPasswordDialog(onDismiss: () -> Unit, onSend: (String) -> Unit) {
    var email by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Reset Password", color = RuvoColors.textPrimary) },
        text = {
            RuvoTextField(value = email, onValueChange = { email = it }, label = "Email", keyboardType = KeyboardType.Email)
        },
        confirmButton = {
            TextButton(onClick = { onSend(email); onDismiss() }) {
                Text("Send Reset Link", color = RuvoColors.lime)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = RuvoColors.textSecondary) }
        },
        containerColor = RuvoColors.surface,
    )
}
