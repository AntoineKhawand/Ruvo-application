/**
 * Generates the HTML email body for a reward redemption.
 * Uses inline styles for maximum email client compatibility.
 * @param {object} data
 * @param {string} data.userName
 * @param {string} data.rewardTitle
 * @param {string} data.code
 * @param {string} data.qrDataUrl - base64 PNG of the QR code
 * @param {string} data.verificationUrl
 * @param {string} [data.expiresAt]
 * @returns {string} HTML string
 */
const buildRewardEmailHtml = ({
    userName,
    rewardTitle,
    code,
    qrDataUrl,
    verificationUrl,
    expiresAt,
}) => {
    const firstName = userName ? userName.split(' ')[0] : 'Runner';
    const expiryText = expiresAt ? `<p style="margin:0 0 4px;font-size:13px;color:#888;">⏱️ Valid for 30 days from today</p>` : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Ruvo Reward</title>
</head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:30px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border-radius:20px;overflow:hidden;border:1px solid #222;">

                    <!-- HEADER -->
                    <tr>
                        <td style="background:#CCFF00;padding:28px 32px 24px;text-align:center;">
                            <p style="margin:0;font-size:28px;font-weight:900;color:#000;letter-spacing:-0.5px;">RUVO</p>
                            <p style="margin:4px 0 0;font-size:10px;font-weight:700;color:rgba(0,0,0,0.5);letter-spacing:3px;text-transform:uppercase;">Rewards Program</p>
                        </td>
                    </tr>

                    <!-- GREETING -->
                    <tr>
                        <td style="padding:32px 32px 20px;">
                            <p style="margin:0;font-size:24px;font-weight:700;color:#fff;line-height:1.3;">
                                Your reward is ready, ${firstName} 🎉
                            </p>
                            <p style="margin:12px 0 0;font-size:15px;color:#888;line-height:1.6;">
                                You successfully redeemed your Ruvo Coins for this reward. Show the QR code or code below at the store to claim your discount.
                            </p>
                        </td>
                    </tr>

                    <!-- REWARD CARD -->
                    <tr>
                        <td style="padding:0 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1C1C1E;border-radius:16px;border:1px solid #2A2A2A;overflow:hidden;">
                                <tr>
                                    <td style="padding:20px 24px;border-bottom:1px solid #2A2A2A;">
                                        <p style="margin:0;font-size:11px;font-weight:700;color:#666;letter-spacing:1.5px;text-transform:uppercase;">Your Reward</p>
                                        <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;line-height:1.2;">
                                            ${rewardTitle}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:20px 24px;text-align:center;">
                                        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" width="180" height="180" style="border-radius:12px;border:4px solid #222;display:block;margin:0 auto;" />` : ''}
                                        <p style="margin:14px 0 4px;font-size:11px;font-weight:700;color:#666;letter-spacing:1.5px;text-transform:uppercase;">Or use this code</p>
                                        <p style="margin:0;font-size:32px;font-weight:900;color:#CCFF00;letter-spacing:4px;font-family:'Courier New',Courier,monospace;">
                                            ${code}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- HOW TO REDEEM -->
                    <tr>
                        <td style="padding:28px 32px 0;">
                            <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#fff;letter-spacing:0.5px;">How to redeem:</p>
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="vertical-align:top;padding-right:12px;">
                                        <div style="width:28px;height:28px;background:#CCFF00;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#000;">1</div>
                                    </td>
                                    <td style="padding-bottom:14px;vertical-align:top;">
                                        <p style="margin:0;font-size:14px;font-weight:600;color:#fff;">Show the QR code or code above</p>
                                        <p style="margin:4px 0 0;font-size:13px;color:#666;line-height:1.5;">Scan the QR code or tell the cashier your redemption code.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="vertical-align:top;padding-right:12px;">
                                        <div style="width:28px;height:28px;background:#CCFF00;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#000;">2</div>
                                    </td>
                                    <td style="padding-bottom:14px;vertical-align:top;">
                                        <p style="margin:0;font-size:14px;font-weight:600;color:#fff;">Get your discount</p>
                                        <p style="margin:4px 0 0;font-size:13px;color:#666;line-height:1.5;">The store will verify your code and apply the discount to your purchase.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="vertical-align:top;padding-right:12px;">
                                        <div style="width:28px;height:28px;background:#CCFF00;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#000;">3</div>
                                    </td>
                                    <td style="vertical-align:top;">
                                        <p style="margin:0;font-size:14px;font-weight:600;color:#fff;">Enjoy your reward</p>
                                        <p style="margin:4px 0 0;font-size:13px;color:#666;line-height:1.5;">Your discount is applied. One-time use only — keep crushing your runs!</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- IMPORTANT NOTE -->
                    <tr>
                        <td style="padding:20px 32px 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,149,0,0.08);border-radius:12px;border:1px solid rgba(255,149,0,0.2);">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="margin:0;font-size:13px;font-weight:700;color:#FF9500;">⚠️ Important</p>
                                        <p style="margin:8px 0 0;font-size:13px;color:#888;line-height:1.6;">
                                            This code is <strong style="color:#fff;">valid for one-time use only</strong>. It will be marked as redeemed after the store approves it. Do not share this code with anyone.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding:32px;text-align:center;border-top:1px solid #1C1C1E;">
                            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#333;letter-spacing:2px;text-transform:uppercase;">Keep running. Keep earning.</p>
                            <p style="margin:0;font-size:12px;color:#444;">
                                Ruvo App &bull; <a href="mailto:support@ruvo.app" style="color:#555;text-decoration:none;">support@ruvo.app</a>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
};

module.exports = { buildRewardEmailHtml };
