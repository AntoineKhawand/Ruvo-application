package com.ruvo.app.features.auth

// Exact port of RN's docs/rn-reference/passwordStrength.js — SignUpScreen.js
// requires ALL 6 rules to pass (isPasswordValid = every rule true), not just
// a minimum length. OnboardingSignUpScreen.js uses the same checklist.
private val COMMON_PASSWORDS = setOf(
    "password1!", "Password1!", "Welcome1!", "Welcome123!", "Admin1234!",
    "Summer2024!", "Winter2024!", "Spring2024!", "Autumn2024!",
    "Football1!", "Baseball1!", "Monkey123!", "Dragon123!",
    "Qwerty123!", "Qwerty1234", "Abc12345!", "Letmein1!",
    "Trustno1!", "Shadow123!", "Master123!", "Superman1!",
    "Batman123!", "Michael1!", "Jordan123!", "Charlie1!",
)

data class PasswordRules(
    val minLength: Boolean,
    val hasUpper: Boolean,
    val hasLower: Boolean,
    val hasNumber: Boolean,
    val hasSymbol: Boolean,
    val notCommon: Boolean,
) {
    val allPass: Boolean get() = minLength && hasUpper && hasLower && hasNumber && hasSymbol && notCommon
}

fun checkPasswordRules(password: String): PasswordRules = PasswordRules(
    minLength = password.length >= 8,
    hasUpper = password.any { it.isUpperCase() },
    hasLower = password.any { it.isLowerCase() },
    hasNumber = password.any { it.isDigit() },
    hasSymbol = password.any { !it.isLetterOrDigit() },
    notCommon = password !in COMMON_PASSWORDS,
)

fun isPasswordValid(password: String): Boolean = checkPasswordRules(password).allPass
