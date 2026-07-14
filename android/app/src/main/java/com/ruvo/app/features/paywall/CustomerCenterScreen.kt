package com.ruvo.app.features.paywall

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.revenuecat.purchases.ui.revenuecatui.customercenter.CustomerCenter
import com.revenuecat.purchases.ui.revenuecatui.customercenter.CustomerCenterOptions

// Thin wrapper around RevenueCat's prebuilt Customer Center UI — lets users
// manage/cancel their subscription and contact support without a custom
// screen. Mirrors the RN reference app's <RevenueCatUI.CustomerCenter />.
@Composable
fun CustomerCenterScreen(onDismiss: () -> Unit = {}) {
    CustomerCenter(
        modifier = Modifier.fillMaxSize(),
        options = CustomerCenterOptions.Builder().build(),
        onDismiss = onDismiss,
    )
}
