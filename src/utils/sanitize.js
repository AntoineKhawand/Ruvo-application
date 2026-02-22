/**
 * Lightweight string sanitization to prevent XSS and malformed data entry to Firestore.
 * Strips HTML tags and trims whitespace.
 * 
 * @param {string} input - The raw string input from the user.
 * @returns {string} The sanitized string.
 */
export const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') return input;

    return input
        .replace(/<\/?[^>]+(>|$)/g, "") // Strip HTML tags
        .trim(); // Remove leading/trailing whitespace
};
