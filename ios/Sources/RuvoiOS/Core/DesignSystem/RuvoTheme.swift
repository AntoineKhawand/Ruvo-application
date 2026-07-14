import SwiftUI

enum RuvoTheme {
    enum Colors {
        static let primary        = Color(hex: "#DFFF00")     // lime
        static let primaryDim     = Color(hex: "#DFFF00").opacity(0.15)
        static let background     = Color(hex: "#050505")
        static let surface        = Color(hex: "#111111")
        static let surfaceElevated = Color(hex: "#1A1A1A")
        static let border         = Color(hex: "#222222")
        static let borderActive   = Color(hex: "#DFFF00").opacity(0.4)
        static let textPrimary    = Color.white
        static let textSecondary  = Color(hex: "#A1A1AA")
        static let textTertiary   = Color(hex: "#52525B")
        static let success        = Color(hex: "#22C55E")
        static let warning        = Color(hex: "#F59E0B")
        static let error          = Color(hex: "#EF4444")
        static let heartRate      = Color(hex: "#EF4444")
        static let vo2max         = Color(hex: "#EA580C")
        static let teal           = Color(hex: "#2DD4BF")
        static let purple         = Color(hex: "#A855F7")
    }

    enum Typography {
        static let displayLarge = Font.custom("Poppins-Black", size: 48)
        static let displayMedium = Font.custom("Poppins-Black", size: 36)
        static let headingLarge  = Font.custom("Poppins-Bold", size: 28)
        static let headingMedium = Font.custom("Poppins-Bold", size: 22)
        static let headingSmall  = Font.custom("Poppins-Bold", size: 18)
        static let bodyLarge     = Font.custom("Poppins-Medium", size: 16)
        static let bodyMedium    = Font.custom("Poppins-Regular", size: 14)
        static let bodySmall     = Font.custom("Poppins-Regular", size: 12)
        static let labelLarge    = Font.custom("Poppins-SemiBold", size: 14)
        static let labelSmall    = Font.custom("Poppins-SemiBold", size: 11)
        static let statNumber    = Font.custom("Poppins-Black", size: 40)
        static let caption       = Font.custom("Poppins-Bold", size: 10)
    }

    enum Spacing {
        static let xs:  CGFloat = 4
        static let sm:  CGFloat = 8
        static let md:  CGFloat = 16
        static let lg:  CGFloat = 24
        static let xl:  CGFloat = 32
        static let xxl: CGFloat = 48
    }

    enum Radius {
        static let sm:  CGFloat = 8
        static let md:  CGFloat = 16
        static let lg:  CGFloat = 24
        static let pill: CGFloat = 999
    }

    enum Shadow {
        static let primaryGlow = Color(hex: "#DFFF00").opacity(0.2)
        static let cardElevation: CGFloat = 20
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
