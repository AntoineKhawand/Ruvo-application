package com.ruvo.app

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class RuvoApplication : Application() {

    @Inject
    lateinit var securityManager: SecurityManager

    override fun onCreate() {
        super.onCreate()
        initFirebase()
        initRevenueCat()
        // RootBeer's checks (incl. shell `su` probing) can take seconds; running them
        // synchronously here blocked Application startup past the OS's process-attach
        // timeout, killing the app before any UI ever showed.
        Thread { securityManager.runChecks(this) }.start()
    }

    private fun initFirebase() {
        FirebaseApp.initializeApp(this)
        val appCheck = FirebaseAppCheck.getInstance()
        // Play Integrity attestation fails on emulators / non-Play-Store images ("Pin
        // verification failed"), which also breaks Firebase Auth's built-in reCAPTCHA
        // check on sign-up/sign-in. The debug provider is Firebase's documented workaround
        // for local development; release builds still enforce Play Integrity.
        if (BuildConfig.ENABLE_LOGGING) {
            appCheck.installAppCheckProviderFactory(
                DebugAppCheckProviderFactory.getInstance()
            )
        } else {
            appCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }
    }

    private fun initRevenueCat() {
        Purchases.logLevel = if (BuildConfig.ENABLE_LOGGING) LogLevel.DEBUG else LogLevel.ERROR
        Purchases.configure(
            PurchasesConfiguration.Builder(this, BuildConfig.REVENUECAT_API_KEY).build()
        )
    }
}
