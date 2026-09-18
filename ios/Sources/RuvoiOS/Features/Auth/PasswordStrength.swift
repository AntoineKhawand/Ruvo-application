import Foundation

// Exact port of Android's PasswordStrength.kt (itself ported from RN's
// docs/rn-reference/passwordStrength.js) -- kept in sync across platforms so
// "strong password" means the same thing everywhere, and so the new
// segmented-strength-bar UI can be driven by real requirements rather than a
// simpler display-only copy.
private let commonPasswords: Set<String> = [
    "password1!", "Password1!", "Welcome1!", "Welcome123!", "Admin1234!",
    "Summer2024!", "Winter2024!", "Spring2024!", "Autumn2024!",
    "Football1!", "Baseball1!", "Monkey123!", "Dragon123!",
    "Qwerty123!", "Qwerty1234", "Abc12345!", "Letmein1!",
    "Trustno1!", "Shadow123!", "Master123!", "Superman1!",
    "Batman123!", "Michael1!", "Jordan123!", "Charlie1!",
]

struct PasswordRules {
    let minLength: Bool
    let hasUpper: Bool
    let hasLower: Bool
    let hasNumber: Bool
    let hasSymbol: Bool
    let notCommon: Bool

    var allPass: Bool { minLength && hasUpper && hasLower && hasNumber && hasSymbol && notCommon }
}

func checkPasswordRules(_ password: String) -> PasswordRules {
    PasswordRules(
        minLength: password.count >= 8,
        hasUpper: password.contains { $0.isUppercase },
        hasLower: password.contains { $0.isLowercase },
        hasNumber: password.contains { $0.isNumber },
        hasSymbol: password.contains { !$0.isLetter && !$0.isNumber },
        notCommon: !commonPasswords.contains(password)
    )
}

func isPasswordValid(_ password: String) -> Bool {
    checkPasswordRules(password).allPass
}
