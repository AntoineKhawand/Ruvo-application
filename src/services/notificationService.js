
export const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
    if (!expoPushToken) {
        console.log("⚠️ No push token for user, skipping notification.");
        return;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        // const result = await response.json();
        // console.log("📣 Notification Sent:", result);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
};
