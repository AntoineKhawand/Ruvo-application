export const HELP_CATEGORIES = [
    {
        id: 'account',
        title: 'Account & Profile',
        icon: 'person-circle-outline',
        faqs: [
            {
                q: "How do I change my profile picture?",
                a: "Go to Settings > Edit Profile, then tap the camera icon on your avatar to upload a new photo."
            },
            {
                q: "Can I change my username?",
                a: "Yes, you can update your display name in the Edit Profile screen. Your unique Runner ID cannot be changed."
            },
            {
                q: "How do I delete my account?",
                a: "Please contact support@ruvo.app with your account email to request permanent deletion."
            }
        ]
    },
    {
        id: 'tracking',
        title: 'Tracking & GPS',
        icon: 'location-outline',
        faqs: [
            {
                q: "Why is my GPS inaccurate?",
                a: "Ensure you have clear sky view. High buildings or dense trees can interfere. Also check that 'Precise Location' is enabled in your phone settings."
            },
            {
                q: "Does Ruvo work on a treadmill?",
                a: "Currently, Ruvo uses GPS for tracking, so indoor treadmill runs may not record distance accurately unless you manually edit the activity later."
            },
            {
                q: "How is calories burned calculated?",
                a: "We use your weight, distance, and pace to estimate calorie burn. Ensure your weight is updated in your profile for better accuracy."
            }
        ]
    },
    {
        id: 'community',
        title: 'Community & Clubs',
        icon: 'people-outline',
        faqs: [
            {
                q: "How do I create a club?",
                a: "Go to the Community tab, tap 'Clubs', then the '+' icon. You can set a name, description, and cover image."
            },
            {
                q: "Can I make my club private?",
                a: "Yes, when creating a club, toggle 'Private Club'. Only users you approve can see posts and join."
            },
            {
                q: "How do referrals work?",
                a: "Share your code from Settings > Invite Friends. When a friend signs up with your code, you both earn rewards!"
            }
        ]
    },
    {
        id: 'privacy',
        title: 'Privacy & Safety',
        icon: 'shield-checkmark-outline',
        faqs: [
            {
                q: "Who can see my runs?",
                a: "You can control this in Settings > Privacy Controls. Options are Public, Followers Only, or Private."
            },
            {
                q: "How do I block a user?",
                a: "Go to their profile, tap the three dots menu, and select 'Block'. They won't be able to see you or comment on your posts."
            }
        ]
    }
];
