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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
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
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.ruvo.app.BuildConfig
import com.ruvo.app.R
import com.ruvo.app.designsystem.components.*
import com.ruvo.app.designsystem.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.UUID
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

// MARK: – Landing / Welcome screen
//
// Premium hero-photo treatment — the native-Android counterpart to the iOS
// WelcomeScreen.swift port: staggered ease-out entrance (headline → subcopy
// → CTA → footer, 70ms apart), a lime accent word inside the headline, and
// press-scale feedback on the CTA. Brand colors come from RuvoColors (the
// app's real lime, #DFFF00) rather than copying the iOS file's slightly
// different placeholder shade.
private val EntranceEasing = RuvoMotion.EaseOut
private const val EntranceStepMillis = RuvoMotion.staggerStepMillis
private const val EntranceDurationMillis = RuvoMotion.Duration.screenEntrance

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
        // Hero video — muted, looping street-runners clip.
        LoopingBackgroundVideo(
            rawResId = R.raw.bg_welcome,
            modifier = Modifier.fillMaxSize(),
        )

        // Scrim so the headline/CTA stay legible regardless of what the video looks like
        // underneath at any given moment.
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
                    animationSpec = RuvoMotion.easeOut(RuvoMotion.Duration.quick),
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

// MARK: – Auth screens: bespoke warm-glow hero treatment
// Ported from a design reference (a dark radial-glow mockup) with its
// original orange recolored to Ruvo's lime, reusing the app's real lime
// tokens (RuvoColors.lime/limeGradientEnd/background) for the bright and
// black ends of the gradient so it stays consistent with the rest of the
// app; only the darkest mid-tone (AuthGlowDark) is new, since nothing else
// needed a dark olive. Bespoke to these two screens -- no other screen
// uses this glass-on-glow look, so these stay local rather than becoming
// design-system tokens.
private val AuthGlowDark = Color(0xFF2B3300)
private val AuthTextPrimary = Color(0xFFF5EFE9)

@Composable
private fun AuthRadialBackground(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(RuvoColors.background)
            .drawWithCache {
                val w = size.width
                val h = size.height
                val rx = 1.20f * w
                val ry = 0.46f * h
                val scaleY = if (rx > 0f) (ry / rx).coerceAtLeast(0.001f) else 1f
                val brush = Brush.radialGradient(
                    colorStops = arrayOf(
                        0f to RuvoColors.lime,
                        0.34f to RuvoColors.limeGradientEnd,
                        0.58f to AuthGlowDark,
                        0.80f to RuvoColors.background,
                        1f to RuvoColors.background,
                    ),
                    center = Offset(w / 2f, 0f),
                    radius = rx,
                )
                onDrawBehind {
                    scale(scaleX = 1f, scaleY = scaleY, pivot = Offset(w / 2f, 0f)) {
                        drawRect(brush = brush, size = Size(w, h / scaleY))
                    }
                }
            }
    )
}

// Square glass badge with the running icon -- the reference's exact shape
// (56dp rounded-16 glass square, not the app's other circular lime badges),
// used only on Sign Up per its source; Sign In drops the icon entirely.
@Composable
private fun AuthBrandBadge() {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.linearGradient(listOf(Color.White.copy(alpha = 0.14f), Color.White.copy(alpha = 0.02f))))
            .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.AutoMirrored.Filled.DirectionsRun,
            contentDescription = null,
            tint = RuvoColors.lime,
            modifier = Modifier.size(30.dp),
        )
    }
}

// Translucent glass pill field matching the reference exactly -- distinct
// from the app-wide RuvoTextField (solid surfaceElev fill), since these two
// screens sit on the radial glow rather than a flat background.
@Composable
private fun AuthGlassField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingContent: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.07f))
            .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(14.dp))
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, tint = AuthTextPrimary.copy(alpha = 0.6f), modifier = Modifier.size(18.dp))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            textStyle = TextStyle(color = AuthTextPrimary, fontSize = 14.5.sp),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            visualTransformation = visualTransformation,
            cursorBrush = SolidColor(AuthTextPrimary),
            decorationBox = { innerTextField ->
                Box {
                    if (value.isEmpty()) {
                        Text(placeholder, color = AuthTextPrimary.copy(alpha = 0.35f), fontSize = 14.5.sp)
                    }
                    innerTextField()
                }
            }
        )
        trailingContent?.invoke()
    }
}

private fun isValidAuthEmail(email: String): Boolean =
    Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email)

// One-shot particle burst (matches the reference's 700ms CSS keyframe) that
// plays once when the email field's validity flips from invalid to valid --
// the reference's version is a static always-on demo flourish tied to
// mount, not to real validation; keying it to a real transition is the
// interactive equivalent for an actual input field.
@Composable
private fun AuthConfettiBurst() {
    val colors = listOf(RuvoColors.calorieOrange, RuvoColors.lime, Color(0xFF34C759), Color(0xFFFFE066), Color(0xFFFF6B81))
    val pieces = remember {
        List(14) { i ->
            val angle = Random.nextDouble() * Math.PI * 2
            val distance = 14 + Random.nextDouble() * 16
            AuthConfettiPiece(
                dx = (cos(angle) * distance).toFloat(),
                dy = (sin(angle) * distance).toFloat(),
                rotation = Random.nextFloat() * 360f - 180f,
                color = colors[i % colors.size],
                isCircle = Random.nextBoolean(),
            )
        }
    }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.animateTo(1f, animationSpec = tween(durationMillis = 700, easing = LinearOutSlowInEasing))
    }
    pieces.forEach { piece ->
        val t = progress.value
        Box(
            modifier = Modifier
                .offset(x = (piece.dx * t).dp, y = (piece.dy * t).dp)
                .size(5.dp)
                .graphicsLayer {
                    alpha = 1f - t
                    scaleX = 1f - 0.6f * t
                    scaleY = 1f - 0.6f * t
                    rotationZ = piece.rotation * t
                }
                .background(piece.color, if (piece.isCircle) CircleShape else RoundedCornerShape(1.dp))
        )
    }
}

private data class AuthConfettiPiece(val dx: Float, val dy: Float, val rotation: Float, val color: Color, val isCircle: Boolean)

@Composable
private fun AuthEmailValidBadge(email: String) {
    var wasValid by remember { mutableStateOf(false) }
    var burstKey by remember { mutableIntStateOf(0) }
    val valid = isValidAuthEmail(email)
    LaunchedEffect(valid) {
        if (valid && !wasValid) burstKey++
        wasValid = valid
    }
    if (valid) {
        Box(modifier = Modifier.size(18.dp), contentAlignment = Alignment.Center) {
            Icon(Icons.Default.CheckCircle, contentDescription = "Valid email", tint = Color(0xFF34C759), modifier = Modifier.size(18.dp))
            key(burstKey) { AuthConfettiBurst() }
        }
    }
}

// Segmented strength bar + label + live checklist, styled to match the
// reference exactly, but driven by the app's REAL 6-rule password policy
// (PasswordStrength.kt, already used to gate signup) rather than the
// reference's simpler 5-rule display-only version -- matching its look
// without quietly weakening what the button actually requires.
@Composable
private fun AuthPasswordStrengthMeter(rules: PasswordRules) {
    // Every one of the 6 real rules still gates the Sign Up button
    // (isPasswordValid) -- this only shortens the DISPLAY to 4 lines instead
    // of 6 (paired rules collapse into one row each) so the checklist
    // doesn't push the rest of the form below the fold on shorter screens.
    val items = listOf(
        "At least 8 characters" to rules.minLength,
        "Upper & lowercase letters" to (rules.hasUpper && rules.hasLower),
        "A number & special character" to (rules.hasNumber && rules.hasSymbol),
        "Not a common password" to rules.notCommon,
    )
    val score = items.count { it.second }
    val total = items.size
    val barColor = when {
        score == 0 -> AuthTextPrimary.copy(alpha = 0.14f)
        score == 1 -> RuvoColors.error
        score <= total - 1 -> RuvoColors.warning
        else -> RuvoColors.success
    }
    val label = when {
        score == 0 -> "Enter a password"
        score == 1 -> "Weak security"
        score <= total - 1 -> "Medium security"
        else -> "Strong security"
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(total) { i ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(4.dp)
                        .clip(RoundedCornerShape(50))
                        .background(if (i < score) barColor else AuthTextPrimary.copy(alpha = 0.14f))
                )
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = AuthTextPrimary)
            Text("$score/$total requirements met", style = MaterialTheme.typography.labelSmall, color = AuthTextPrimary.copy(alpha = 0.45f))
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            items.forEach { (text, met) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Icon(
                        if (met) Icons.Default.Check else Icons.Default.Close,
                        contentDescription = null,
                        tint = if (met) RuvoColors.success else AuthTextPrimary.copy(alpha = 0.4f),
                        modifier = Modifier.size(13.dp),
                    )
                    Text(text, style = MaterialTheme.typography.bodySmall, color = if (met) Color(0xFF34D399) else AuthTextPrimary.copy(alpha = 0.45f))
                }
            }
        }
    }
}

// MARK: – Shared "prompt + action" footer link (Sign In <-> Sign Up)
@Composable
fun AuthFooterLink(prompt: String, action: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(prompt, style = MaterialTheme.typography.bodyMedium, color = AuthTextPrimary.copy(alpha = 0.6f))
        TextButton(onClick = onClick) {
            Text(action, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = RuvoColors.lime)
        }
    }
}

// Terms & Conditions checkbox (Sign Up only). The reference defaults this
// to pre-checked ("agreed: true" on mount) -- kept unchecked by default
// here instead: a pre-ticked consent box is a real dark pattern (and
// unlawful under GDPR-style consent rules), not just a style choice, so
// this is the one deliberate behavioral deviation from "exactly as is".
@Composable
fun TermsCheckbox(checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .padding(top = 2.dp)
                .size(18.dp)
                .clip(RoundedCornerShape(5.dp))
                .then(
                    if (checked) {
                        Modifier.background(Brush.linearGradient(listOf(RuvoColors.lime, RuvoColors.limeGradientEnd)))
                    } else {
                        Modifier.border(1.5.dp, AuthTextPrimary.copy(alpha = 0.35f), RoundedCornerShape(5.dp))
                    }
                ),
            contentAlignment = Alignment.Center,
        ) {
            // The reference dims this to 35% opacity rather than hiding it when
            // unchecked -- verified live on device that this reads as ambiguously
            // "still checked" at a glance, not clearly off, for a control that
            // gates form submission. Showing an empty outline when unchecked
            // instead removes that ambiguity.
            if (checked) {
                Icon(Icons.Default.Check, contentDescription = null, tint = Color.Black, modifier = Modifier.size(11.dp))
            }
        }
        Text(
            text = buildAnnotatedString {
                withStyle(SpanStyle(color = AuthTextPrimary.copy(alpha = 0.65f))) { append("By tapping here you agree to our ") }
                withStyle(SpanStyle(color = RuvoColors.lime)) { append("Terms and Conditions") }
                withStyle(SpanStyle(color = AuthTextPrimary.copy(alpha = 0.65f))) { append(" & ") }
                withStyle(SpanStyle(color = RuvoColors.lime)) { append("Privacy Policy") }
            },
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

// MARK: – Login Screen
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onSignUp: () -> Unit = {},
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showForgotPassword by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }

    val uiState by viewModel.uiState.collectAsState()
    val isLoading by viewModel.isSubmitting.collectAsState()
    val errorMessage = (uiState as? AuthUiState.Error)?.message

    Box(modifier = Modifier.fillMaxSize()) {
        AuthRadialBackground()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = AuthTextPrimary)
            }

            // No brand badge here -- Sign In drops the icon per design direction,
            // unlike Sign Up which keeps it.
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Welcome Back", style = MaterialTheme.typography.headlineLarge, color = AuthTextPrimary)
                Text(
                    "Log in to continue your streak",
                    style = MaterialTheme.typography.bodyLarge,
                    color = AuthTextPrimary.copy(alpha = 0.55f),
                    textAlign = TextAlign.Center,
                )
            }

            AuthGlassField(value = email, onValueChange = { email = it }, placeholder = "Email", leadingIcon = Icons.Default.Email, keyboardType = KeyboardType.Email)
            AuthGlassField(
                value = password,
                onValueChange = { password = it },
                placeholder = "Password",
                leadingIcon = Icons.Default.Lock,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingContent = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }, modifier = Modifier.size(26.dp)) {
                        Icon(
                            if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = "Toggle visibility",
                            tint = AuthTextPrimary.copy(alpha = 0.55f),
                            modifier = Modifier.size(16.dp),
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
                text = "Log In",
                onClick = { viewModel.signInWithEmail(email, password) },
                isLoading = isLoading,
                modifier = Modifier.shadow(
                    elevation = RuvoShadow.cardElevation,
                    shape = CircleShape,
                    ambientColor = RuvoShadow.primaryGlow,
                    spotColor = RuvoShadow.primaryGlow,
                ),
            )

            AuthDivider()
            GoogleSignInButton(onGoogleSignIn = viewModel::signInWithGoogle, onError = viewModel::reportError)

            AuthFooterLink(prompt = "Don't have an account?", action = "Sign Up", onClick = onSignUp)
        }
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
    onSignIn: () -> Unit = {},
) {
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var agreedToTerms by remember { mutableStateOf(false) }

    val uiState by viewModel.uiState.collectAsState()
    val isLoading by viewModel.isSubmitting.collectAsState()
    val errorMessage = (uiState as? AuthUiState.Error)?.message

    Box(modifier = Modifier.fillMaxSize()) {
        AuthRadialBackground()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = AuthTextPrimary)
            }

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                AuthBrandBadge()
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Sign Up", style = MaterialTheme.typography.headlineLarge, color = AuthTextPrimary)
                    Text(
                        "Let's create your account",
                        style = MaterialTheme.typography.bodyLarge,
                        color = AuthTextPrimary.copy(alpha = 0.55f),
                        textAlign = TextAlign.Center,
                    )
                }
            }

            AuthGlassField(value = displayName, onValueChange = { displayName = it }, placeholder = "Full Name", leadingIcon = Icons.Default.Person)
            AuthGlassField(
                value = email,
                onValueChange = { email = it },
                placeholder = "Email",
                leadingIcon = Icons.Default.Email,
                keyboardType = KeyboardType.Email,
                trailingContent = { AuthEmailValidBadge(email) },
            )

            Text("Secure Password", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = AuthTextPrimary)
            AuthGlassField(
                value = password,
                onValueChange = { password = it },
                placeholder = "Create a strong password",
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingContent = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }, modifier = Modifier.size(26.dp)) {
                        Icon(
                            if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = "Toggle visibility",
                            tint = AuthTextPrimary.copy(alpha = 0.55f),
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            )
            // Real 6-rule policy (PasswordStrength.kt) drives both this meter and
            // the button's enabled state below -- same source of truth, not a
            // display-only copy that could drift from what's actually required.
            // Shown once typing starts, matching the live-checklist behavior this
            // app already used before the restyle.
            AnimatedVisibility(visible = password.isNotEmpty()) {
                AuthPasswordStrengthMeter(rules = checkPasswordRules(password))
            }

            AnimatedVisibility(visible = errorMessage != null) {
                Text(errorMessage ?: "", style = MaterialTheme.typography.bodySmall, color = RuvoColors.error)
            }

            TermsCheckbox(checked = agreedToTerms, onCheckedChange = { agreedToTerms = it })

            RuvoButton(
                text = "Sign Up",
                onClick = { viewModel.signUpWithEmail(email, password, displayName) },
                isLoading = isLoading,
                enabled = displayName.isNotBlank() && email.isNotBlank() && isPasswordValid(password) && agreedToTerms,
                modifier = Modifier.shadow(
                    elevation = if (agreedToTerms) RuvoShadow.cardElevation else 0.dp,
                    shape = CircleShape,
                    ambientColor = RuvoShadow.primaryGlow,
                    spotColor = RuvoShadow.primaryGlow,
                ),
            )

            AuthDivider()
            GoogleSignInButton(onGoogleSignIn = viewModel::signInWithGoogle, onError = viewModel::reportError)

            AuthFooterLink(prompt = "Already have an account?", action = "Log In", onClick = onSignIn)
        }
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

// Real bug found 2026-09-11: this button was a UI-only stub — its onClick was a
// bare comment ("trigger Google Sign-In from Activity"), so tapping it did
// nothing at all. AuthViewModel.signInWithGoogle(idToken) was already fully
// implemented and BuildConfig.GOOGLE_WEB_CLIENT_ID was already wired from
// local.properties (see its comment there) — the Credential Manager call
// that was supposed to produce that token was simply never written. This is
// that missing piece: Credential Manager + Google Identity's
// GetSignInWithGoogleOption, using the existing web client ID, with a hashed
// nonce (Google's own recommended pattern, guards against a replayed token).
@Composable
fun GoogleSignInButton(onGoogleSignIn: (String) -> Unit, onError: (String) -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(CircleShape)
            .clickable {
                scope.launch {
                    try {
                        val nonce = UUID.randomUUID().toString()
                        val hashedNonce = MessageDigest.getInstance("SHA-256")
                            .digest(nonce.toByteArray())
                            .joinToString("") { "%02x".format(it) }

                        val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                            .setNonce(hashedNonce)
                            .build()
                        val request = GetCredentialRequest.Builder()
                            .addCredentialOption(option)
                            .build()

                        val result = CredentialManager.create(context).getCredential(context, request)
                        val googleCredential = GoogleIdTokenCredential.createFrom(result.credential.data)
                        onGoogleSignIn(googleCredential.idToken)
                    } catch (e: GetCredentialCancellationException) {
                        // User dismissed the picker — not an error worth surfacing.
                    } catch (e: NoCredentialException) {
                        onError("No Google account found on this device.")
                    } catch (e: GetCredentialException) {
                        onError(e.message ?: "Google sign-in failed.")
                    }
                }
            },
        shape = CircleShape,
        color = RuvoColors.surfaceElev,
        border = BorderStroke(1.dp, RuvoColors.border)
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Image(
                painter = painterResource(R.drawable.ic_google_logo),
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text("Continue with Google", style = MaterialTheme.typography.labelLarge, color = RuvoColors.textPrimary)
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
