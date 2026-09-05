package com.ruvo.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

// Real ANR found live 2026-09-06: RunReminderBootReceiver (a BroadcastReceiver,
// no foreground Activity) spawns this process cold on BOOT_COMPLETED, and this
// class's own onCreate() below — same class, unconditionally, regardless of
// which component triggered the process — took 40+ seconds to finish in that
// bare broadcast-only process (vs. ~8s warmed by a foreground Activity launch
// moments later), tripping the OS's broadcast-delivery ANR timeout and killing
// the process before the receiver's onReceive() ever ran. Implementing
// Configuration.Provider + HiltWorkerFactory here doesn't change anything
// onCreate() itself does — it only gives RunReminderBootReceiver a way to hand
// its restore work to a WorkManager job instead of running it inline off this
// receiver's own (equally throttled) process, so that work gets a real
// scheduling slot instead of racing this class's slow init.
@HiltAndroidApp
class RuvoApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var securityManager: SecurityManager

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

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
