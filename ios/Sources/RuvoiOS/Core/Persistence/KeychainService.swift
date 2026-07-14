import Foundation
import Security

final class KeychainService {
    private let service = "com.ruvo.app"

    func save(_ value: String, forKey key: String) throws {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecValueData:   data
        ]
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    func load(forKey key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      service,
            kSecAttrAccount:      key,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(forKey key: String) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ]
        SecItemDelete(query as CFDictionary)
    }

    enum KeychainError: Error {
        case saveFailed(OSStatus)
    }

    // MARK: – Named keys
    enum Key {
        static let ouraAccessToken   = "oura_access_token"
        static let ouraRefreshToken  = "oura_refresh_token"
        static let whoopAccessToken  = "whoop_access_token"
        static let whoopRefreshToken = "whoop_refresh_token"
        static let biometricEnabled  = "biometric_enabled"
    }
}
