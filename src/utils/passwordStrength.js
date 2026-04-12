// Common passwords that would pass length + complexity checks but are still weak.
// Kept small — the complexity rules already block the vast majority of weak passwords.
const COMMON_PASSWORDS = new Set([
  'password1!', 'Password1!', 'Welcome1!', 'Welcome123!', 'Admin1234!',
  'Summer2024!', 'Winter2024!', 'Spring2024!', 'Autumn2024!',
  'Football1!', 'Baseball1!', 'Monkey123!', 'Dragon123!',
  'Qwerty123!', 'Qwerty1234', 'Abc12345!', 'Letmein1!',
  'Trustno1!', 'Shadow123!', 'Master123!', 'Superman1!',
  'Batman123!', 'Michael1!', 'Jordan123!', 'Charlie1!',
]);

/**
 * Returns an object describing which password requirements are met.
 * @param {string} password
 * @returns {{ minLength: boolean, hasUpper: boolean, hasLower: boolean, hasNumber: boolean, hasSymbol: boolean, notCommon: boolean }}
 */
export const checkPasswordRules = (password) => ({
  minLength: password.length >= 8,
  hasUpper:  /[A-Z]/.test(password),
  hasLower:  /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSymbol: /[^A-Za-z0-9]/.test(password),
  notCommon: !COMMON_PASSWORDS.has(password),
});

/**
 * Returns true only when all rules pass.
 */
export const isPasswordValid = (password) =>
  Object.values(checkPasswordRules(password)).every(Boolean);

/**
 * Returns a strength label: 'weak' | 'fair' | 'strong'
 */
export const passwordStrengthLabel = (password) => {
  const rules = checkPasswordRules(password);
  const passed = Object.values(rules).filter(Boolean).length;
  if (passed <= 3) return 'weak';
  if (passed <= 5) return 'fair';
  return 'strong';
};
