import CoreText
import Foundation

/// Registers the bundled Poppins `.ttf` files so `Font.custom("Poppins-*", size:)`
/// in `RuvoTheme` can actually find them.
///
/// `UIAppFonts` in Info.plist only auto-registers fonts that live in the *app*
/// bundle. These ship inside this Swift package's own resource bundle
/// (`Sources/RuvoiOS/Resources/Fonts`, reached via `Bundle.module`), so they
/// need to be registered by hand, once, before any themed view renders.
enum PoppinsFontLoader {
    private static var didRegister = false

    private static let fontNames = [
        "Poppins-Regular",
        "Poppins-Medium",
        "Poppins-SemiBold",
        "Poppins-Bold",
        "Poppins-Black",
    ]

    static func registerIfNeeded() {
        guard !didRegister else { return }
        didRegister = true

        for name in fontNames {
            guard let url = Bundle.module.url(forResource: name, withExtension: "ttf") else {
                assertionFailure("Missing bundled font: \(name).ttf")
                continue
            }
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                let reason = error?.takeRetainedValue().localizedDescription ?? "unknown error"
                print("⚠️ PoppinsFontLoader: failed to register \(name) — \(reason)")
            }
        }
    }
}
