// Pure Kotlin/JVM module, deliberately no Android or Compose dependency at
// all — both :app (phone) and :wear (watch) depend on this for the one
// thing they must agree on byte-for-byte: the Data Layer message schema.
// Kept dependency-free so it can't accidentally pull anything
// phone-specific (Firebase, Maps) or watch-specific (Wear Compose) into
// the other side.
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.kotlinx.serialization)
    testImplementation(libs.junit)
}
