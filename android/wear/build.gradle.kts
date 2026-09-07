// Wear OS companion app (phone-tracked mode — see the root
// RN_ANDROID_PORT_MAPPING.md "Wear OS companion" log entry for the full
// scope decision). Deliberately dependency-light: no Firebase, no Hilt, no
// Maps — the watch never talks to anything but the paired phone, over
// Wearable Data Layer, using the shared message schema in :wearshared.
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.ruvo.wear"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ruvo.app.wear"
        minSdk = 30 // Wear OS 3+ — the current Wear Compose baseline
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
    }
}

dependencies {
    implementation(project(":wearshared"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.lifecycle.runtime)

    implementation(libs.play.services.wearable)
    implementation(libs.coroutines.android)
    implementation(libs.coroutines.play.services)
}
