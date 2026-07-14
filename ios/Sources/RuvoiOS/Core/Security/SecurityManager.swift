import Foundation
import IOSSecuritySuite

final class SecurityManager {
    private(set) var isJailbroken = false
    private(set) var isReverseEngineered = false
    private(set) var isEmulator = false

    func runChecks() {
        isJailbroken = IOSSecuritySuite.amIJailbroken()
        isReverseEngineered = IOSSecuritySuite.amIReverseEngineered()
        isEmulator = IOSSecuritySuite.amIRunInEmulator()

        if isJailbroken {
            // Log to analytics but don't hard-block — pairing with App Check for actual enforcement
            print("[Security] Jailbreak detected — logging but not blocking")
        }
    }

    // MARK: – SSL Pinning
    // Implemented via URLSessionDelegate in NetworkSession; fingerprints stored here for easy rotation.
    enum PinnedCertificates {
        // SHA-256 public key hashes for Firebase endpoints
        static let firebase: [String] = [
            // Replace with actual fingerprints before production release
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
        ]
    }
}

// MARK: – URLSession with certificate pinning
import CryptoKit

final class PinnedURLSession: NSObject, URLSessionDelegate {
    static let shared = PinnedURLSession()
    lazy var session: URLSession = URLSession(configuration: .default, delegate: self, delegateQueue: nil)

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        var secResult = SecTrustResultType.invalid
        SecTrustEvaluate(serverTrust, &secResult)

        guard let serverCert = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        let serverKey = publicKeyHash(for: serverCert)
        let trusted = SecurityManager.PinnedCertificates.firebase.contains(serverKey)

        if trusted {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }

    private func publicKeyHash(for certificate: SecCertificate) -> String {
        guard let publicKey = SecCertificateCopyKey(certificate),
              let keyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
            return ""
        }
        let hash = SHA256.hash(data: keyData)
        return Data(hash).base64EncodedString()
    }
}
