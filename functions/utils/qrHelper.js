const QRCode = require('qrcode');

/**
 * Generates a QR code as a base64 PNG data URL.
 * The QR encodes a Ruvo verification URL.
 * @param {string} code - The redemption code (e.g. RUVO-7X9K2M)
 * @param {string} baseUrl - The web app base URL
 * @returns {Promise<string>} data:image/png;base64,...
 */
const generateQRDataUrl = async (code, baseUrl = 'https://ruvo-app.web.app') => {
    const verificationUrl = `${baseUrl}/verify.html?code=${encodeURIComponent(code)}`;
    
    return QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 2,
        width: 280,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });
};

/**
 * Generates a short verification URL (no QR, just the link).
 * @param {string} code
 * @param {string} baseUrl
 */
const getVerificationUrl = (code, baseUrl = 'https://ruvo-app.web.app') => {
    return `${baseUrl}/verify.html?code=${encodeURIComponent(code)}`;
};

module.exports = { generateQRDataUrl, getVerificationUrl };
