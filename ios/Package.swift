// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RuvoiOS",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RuvoiOS", targets: ["RuvoiOS"])
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "10.0.0"),
        .package(url: "https://github.com/RevenueCat/purchases-ios.git", from: "4.0.0"),
        .package(url: "https://github.com/nicklockwood/SwiftFormat.git", from: "0.52.0"),
        .package(url: "https://github.com/securing/IOSSecuritySuite.git", from: "1.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher.git", from: "7.0.0"),
        .package(url: "https://github.com/openid/AppAuth-iOS.git", .upToNextMajor(from: "1.7.0")),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "7.0.0"),
    ],
    targets: [
        .target(
            name: "RuvoiOS",
            dependencies: [
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFunctions", package: "firebase-ios-sdk"),
                .product(name: "FirebaseStorage", package: "firebase-ios-sdk"),
                .product(name: "FirebaseRemoteConfig", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAppCheck", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "RevenueCat", package: "purchases-ios"),
                .product(name: "IOSSecuritySuite", package: "IOSSecuritySuite"),
                .product(name: "Kingfisher", package: "Kingfisher"),
                .product(name: "AppAuth", package: "AppAuth-iOS"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
            ],
            path: "Sources/RuvoiOS",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "RuvoiOSTests",
            dependencies: ["RuvoiOS"],
            path: "Tests/RuvoiOSTests"
        )
    ]
)
