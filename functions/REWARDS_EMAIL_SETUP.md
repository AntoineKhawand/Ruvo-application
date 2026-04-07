# Rewards Email System — Setup Guide

## Overview

When a user redeems a reward, Ruvo sends them an HTML email containing:
- A QR code (scannable at the store)
- The redemption code
- Step-by-step instructions
- The reward name and validity period

Store staff scan the QR code → verification page opens → they tap "Approve Discount."

## 1. Set up Resend

1. Go to [resend.com](https://resend.com) and create a free account
2. Navigate to **API Keys** → **Create API Key**
3. Copy the key (starts with `re_`)
4. Add it to Firebase environment secrets:

```bash
firebase functions:config:set resend.api_key="re_your_key_here"
```

Or via Firebase Console:
**Functions → Configuration → Add parameter** → `resend.api_key`

## 2. Verify your sender domain (required by Resend)

- Go to **Domains** in Resend dashboard
- Add `ruvo.app` (or your domain)
- Add the DNS records Resend provides (SPF, DKIM, MX)
- Wait for verification (usually a few minutes)

## 3. Update the `WEB_APP_URL` constant

In `functions/index.js`, update this line to match your Firebase Hosting URL:

```javascript
const WEB_APP_URL = "https://ruvo-app.web.app";
```

Replace `ruvo-app.web.app` with your actual Firebase Hosting domain.

## 4. Deploy the updated functions

```bash
cd functions
firebase deploy --only functions
```

## 5. Deploy the verification webpage

The `public/verify.html` file is the verification page for store staff.
Deploy it to Firebase Hosting:

```bash
firebase deploy --only hosting
```

Make sure `firebase.json` includes:

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [...]
  }
}
```

## 6. Test the flow

1. Create a test user with coins in Firestore
2. Call `redeemReward` via the app
3. Check the user's email for the HTML email with QR code
4. Scan the QR code → verify the page loads correctly
5. Tap "Approve Discount" → check Firestore that status changed to `used`

## Security Notes

- Codes are **cryptographically random** — cannot be guessed
- Codes are **one-time use** — marked as `used` after store approval
- Codes **expire after 30 days** — checked in both endpoints
- The `verifyRewardCode` and `redeemRewardCode` endpoints are **public** (no auth needed) since they serve store staff who don't have Firebase auth
- The Admin SDK bypasses all Firestore security rules

## Troubleshooting

**Email not sending?**
- Check Firebase function logs: `firebase functions:log`
- Verify `RESEND_API_KEY` is set correctly
- Verify sender domain is verified in Resend

**QR code not loading in email?**
- Some email clients (Outlook, Apple Mail) may block external images
- The plain-text code is always shown below the QR as fallback

**Verification page not found?**
- Make sure `public/verify.html` is deployed to Firebase Hosting
- Check the `WEB_APP_URL` constant matches your hosting domain
