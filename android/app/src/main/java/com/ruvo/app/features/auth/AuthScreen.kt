package com.ruvo.app.features.auth

import android.provider.Settings
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ruvo.app.R
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import kotlinx.coroutines.delay

// MARK: – Landing / Welcome screen
//
// Premium hero-photo treatment — the native-Android counterpart to the iOS
// WelcomeScreen.swift port: staggered ease-out entrance (headline → subcopy
// → CTA → footer, 70ms apart), a lime accent word inside the headline, and
// press-scale feedback on the CTA. Brand colors come from RuvoColors (the
// app's real lime, #DFFF00) rather than copying the iOS file's slightly
// different placeholder shade.
private val EntranceEasing = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)
private const val EntranceStepMillis = 70
private const val EntranceDurationMillis = 520

@Composable
private fun rememberReducedMotionEnabled(): Boolean {
    val context = LocalContext.current
    return remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}

/** Fade + slide-up entrance for the element at [step] in the stagger chain (0 = first). */
@Composable
private fun rememberEntrance(
    visible: Boolean,
    step: Int,
    reduceMotion: Boolean,
    distance: Dp = 12.dp,
): Pair<Float, Dp> {
    val duration = if (reduceMotion) 1 else EntranceDurationMillis
    val delayMillis = step * EntranceStepMillis
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(durationMillis = duration, delayMillis = delayMillis, easing = EntranceEasing),
        label = "entranceAlpha$step",
    )
    val offsetY by animateDpAsState(
        targetValue = if (visible || reduceMotion) 0.dp else distance,
        animationSpec = tween(durationMillis = duration, delayMillis = delayMillis, easing = EntranceEasing),
        label = "entranceOffset$step",
    )
    return alpha to offsetY
}

@Composable
fun LandingScreen(
    onGetStarted: () -> Unit,
    onSignIn: () -> Unit,
) {
    val reduceMotion = rememberReducedMotionEnabled()
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(20)
        appeared = true
    }

    val (headlineAlpha, headlineOffset) = rememberEntrance(appeared, step = 0, reduceMotion)
    val (subcopyAlpha, subcopyOffset) = rememberEntrance(appeared, step = 1, reduceMotion)
    val (ctaAlpha, ctaOffset) = rememberEntrance(appeared, step = 2, reduceMotion)
    val (footerAlpha, footerOffset) = rememberEntrance(appeared, step = 3, reduceMotion)

    Box(modifier = Modifier.fillMaxSize()) {
        // Hero photo — top-down runner shot, already fading to black toward the bottom.
        Image(
            painter = painterResource(R.drawable.bg_welcome),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        // Scrim so the headline/CTA stay legible regardless of what the photo looks like
        // underneath — the photo's own fade only covers its bottom third.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            RuvoColors.background.copy(alpha = 0.35f),
                            RuvoColors.background.copy(alpha = 0.85f),
                            RuvoColors.background,
                        ),
                        startY = 0f,
                    )
                )
        )

        // Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp)
                .padding(bottom = 60.dp),
        ) {
            Spacer(modifier = Modifier.weight(1f))

            // Bottom text section
            Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                Text(
                    text = buildAnnotatedString {
                        append("Take Control of\nYour ")
                        withStyle(SpanStyle(color = RuvoColors.lime)) { append("Running") }
                        append(" Journey")
                    },
                    fontSize = 31.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                    lineHeight = 40.sp,
                    modifier = Modifier
                        .alpha(headlineAlpha)
                        .offset(y = headlineOffset),
                )
                Spacer(modifier = Modifier.height(15.dp))
                Text(
                    text = "Track your progress, set new challenges, and conquer your goals with ease.",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Normal,
                    color = Color(0xFFEEEEEE),
                    lineHeight = 24.sp,
                    modifier = Modifier
                        .alpha(subcopyAlpha)
                        .offset(y = subcopyOffset),
                )
                Spacer(modifier = Modifier.height(30.dp))

                // Start Journey button — scales down to 0.97 on press, matching the iOS CTA.
                val ctaInteractionSource = remember { MutableInteractionSource() }
                val ctaPressed by ctaInteractionSource.collectIsPressedAsState()
                val ctaPressScale by animateFloatAsState(
                    targetValue = if (ctaPressed) 0.97f else 1f,
                    animationSpec = tween(durationMillis = 160, easing = LinearOutSlowInEasing),
                    label = "ctaPressScale",
                )
                Button(
                    onClick = onGetStarted,
                    interactionSource = ctaInteractionSource,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .alpha(ctaAlpha)
                        .offset(y = ctaOffset)
                        .scale(ctaPressScale),
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
                        .alpha(footerAlpha)
                        .offset(y = footerOffset)
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
    val isLoading by viewModel.isSubmitting.collectAsState()
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
    val isLoading by viewModel.isSubmitting.collectAsState()
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
        )
        // RN's SignUpScreen.js requires ALL 6 rules from passwordStrength.js
        // to pass (isPasswordValid), shown live as a checklist — not just a
        // minimum-length message. Only shown once the user starts typing, matching
        // RN's live-checklist behavior (no checklist on an empty field).
        AnimatedVisibility(visible = password.isNotEmpty()) {
            PasswordRulesChecklist(rules = checkPasswordRules(password))
        }
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
            enabled = displayName.isNotBlank() && email.isNotBlank() && isPasswordValid(password) && password == confirmPassword
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
fun PasswordRulesChecklist(rules: PasswordRules, modifier: Modifier = Modifier) {
    val items = listOf(
        "At least 8 characters" to rules.minLength,
        "An uppercase letter" to rules.hasUpper,
        "A lowercase letter" to rules.hasLower,
        "A number" to rules.hasNumber,
        "A symbol" to rules.hasSymbol,
        "Not a common password" to rules.notCommon,
    )
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        items.forEach { (label, met) ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    if (met) Icons.Default.CheckCircle else Icons.Default.Cancel,
                    contentDescription = null,
                    tint = if (met) RuvoColors.lime else RuvoColors.textTertiary,
                    modifier = Modifier.size(14.dp),
                )
                Text(label, style = MaterialTheme.typography.bodySmall, color = if (met) RuvoColors.textSecondary else RuvoColors.textTertiary)
            }
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
