import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.google.services)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.ruvo.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ruvo.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        val localProps = Properties().apply {
            val f = rootProject.file("local.properties")
            if (f.exists()) load(f.inputStream())
        }
        buildConfigField("String", "OURA_CLIENT_ID",  "\"${localProps.getProperty("OURA_CLIENT_ID", "")}\"")
        buildConfigField("String", "WHOOP_CLIENT_ID", "\"${localProps.getProperty("WHOOP_CLIENT_ID", "")}\"")
        buildConfigField("String", "MAPS_API_KEY",    "\"${localProps.getProperty("MAPS_API_KEY", "")}\"")
        buildConfigField("String", "REVENUECAT_API_KEY",    "\"${localProps.getProperty("REVENUECAT_API_KEY", "")}\"")
        buildConfigField("String", "OPENWEATHER_API_KEY", "\"${localProps.getProperty("OPENWEATHER_API_KEY", "")}\"")
        buildConfigField("boolean", "USE_FIREBASE_EMULATOR", localProps.getProperty("USE_FIREBASE_EMULATOR", "false"))
        // Not yet consumed by any Kotlin code — Google/Facebook login aren't wired up on
        // Android yet. Extracted from the RN reference app so the values aren't lost.
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${localProps.getProperty("GOOGLE_WEB_CLIENT_ID", "")}\"")
        buildConfigField("String", "FACEBOOK_APP_ID", "\"${localProps.getProperty("FACEBOOK_APP_ID", "")}\"")
        buildConfigField("String", "FACEBOOK_CLIENT_TOKEN", "\"${localProps.getProperty("FACEBOOK_CLIENT_TOKEN", "")}\"")

        manifestPlaceholders["mapsApiKey"] = localProps.getProperty("MAPS_API_KEY", "")
        manifestPlaceholders["appAuthRedirectScheme"] = "com.ruvo.app"
    }

    buildTypes {
        debug {
            isDebuggable = true
            applicationIdSuffix = ".debug"
            buildConfigField("Boolean", "ENABLE_LOGGING", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("Boolean", "ENABLE_LOGGING", "false")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Compose
    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling)
    implementation(libs.compose.material3)
    implementation(libs.compose.animation)
    implementation(libs.compose.foundation)
    implementation(libs.compose.icons.extended)
    implementation(libs.activity.compose)

    // Navigation + Lifecycle
    implementation(libs.navigation.compose)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.lifecycle.runtime)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.functions)
    implementation(libs.firebase.storage)
    implementation(libs.firebase.remote.config)
    implementation(libs.firebase.app.check)
    debugImplementation(libs.firebase.app.check.debug)
    implementation(libs.firebase.messaging)

    // Maps + Location
    implementation(libs.maps.compose)
    implementation(libs.play.services.maps)
    implementation(libs.play.services.location)

    // Wear OS companion (phone-tracked mode) — see WearSync.kt's doc
    // comment. :wearshared is the message-schema module both this app and
    // :wear depend on.
    implementation(project(":wearshared"))
    implementation(libs.play.services.wearable)

    // Security
    implementation(libs.rootbeer)
    implementation(libs.security.crypto)
    implementation(libs.play.integrity)
    implementation(libs.biometric)
    implementation(libs.appcompat)

    // RevenueCat
    implementation(libs.revenuecat)
    implementation(libs.revenuecat.ui)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlin.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // Charts
    implementation(libs.vico.compose)
    implementation(libs.vico.compose.m3)

    // Health Connect
    implementation(libs.health.connect)

    // Images
    implementation(libs.coil)

    // Room
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // WorkManager
    implementation(libs.work.runtime)
    implementation(libs.hilt.work)
    ksp(libs.hilt.work.compiler)

    // Paging
    implementation(libs.paging.runtime)
    implementation(libs.paging.compose)

    // DataStore
    implementation(libs.datastore.prefs)

    // AppAuth (Oura/WHOOP OAuth)
    implementation(libs.appauth)

    // Coroutines
    implementation(libs.coroutines.android)

    // Serialization
    implementation(libs.kotlinx.serialization)

    // Testing (JVM unit tests — no emulator/device needed)
    testImplementation(libs.junit)
}
