/**
 * Hardened string sanitization to prevent XSS, oversized payloads, 
 * and malformed data entry to Firestore.
 * * @param {string} input - The raw string input from the user.
 * @param {number} maxLength - The maximum allowed length (default: 1000).
 * @returns {string|null} The sanitized string, or null if invalid.
 */
export const sanitizeInput = (input, maxLength = 1000) => {
    // 1. Strict Type Checking (Deny arrays/objects acting as strings)
    if (input === null || input === undefined) return '';

    // If it's not a string (e.g., a malicious object payload), force it to a string or reject
    if (typeof input !== 'string') {
        console.warn('Sanitize: Blocked non-string input');
        return '';
    }

    // 2. Core XSS Sanitization & Trimming
    let cleaned = input
        .replace(/<\/?[^>]+(>|$)/g, "") // Strip HTML tags
        .trim();

    // 3. Length Truncation (Prevents database bloat/DDoS via massive strings)
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength);
    }

    return cleaned;
};

