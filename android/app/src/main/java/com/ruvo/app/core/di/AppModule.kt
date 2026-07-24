package com.ruvo.app.core.di

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import com.ruvo.app.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object FirebaseModule {

    // 10.0.2.2 is the Android emulator's alias for the host machine's localhost.
    // USE_FIREBASE_EMULATOR is off unless set in local.properties (see summary.md) —
    // it points debug builds at `firebase emulators:start` so Auth/Firestore work
    // without hitting Play Integrity, which real Firebase Auth requires and which
    // fails on non-Play-Store-attested devices.
    @Provides @Singleton
    fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance().apply {
        if (BuildConfig.USE_FIREBASE_EMULATOR) useEmulator("10.0.2.2", 9099)
    }

    @Provides @Singleton
    fun provideFirestore(): FirebaseFirestore = FirebaseFirestore.getInstance().apply {
        if (BuildConfig.USE_FIREBASE_EMULATOR) useEmulator("10.0.2.2", 8081)
    }

    @Provides @Singleton
    fun provideFirebaseFunctions(): FirebaseFunctions = FirebaseFunctions.getInstance("us-central1").apply {
        // Was missing while Auth/Firestore both correctly emulator-gated above — every
        // callable (askGemini, saveRunActivity, redeemReward, deleteAccountData) was
        // silently hitting real production with a local-emulator auth token, which
        // production rejects. Real bug, not a hypothetical: reproduced as an
        // HttpsError("internal") from saveRunActivity during live testing.
        if (BuildConfig.USE_FIREBASE_EMULATOR) useEmulator("10.0.2.2", 5001)
    }

    @Provides @Singleton
    fun provideFirebaseStorage(): FirebaseStorage = FirebaseStorage.getInstance()
}

// SecurityManager uses @Inject constructor() + @Singleton so no module binding needed
