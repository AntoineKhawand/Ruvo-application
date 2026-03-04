const { withAppBuildGradle, withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNetworkSecurityConfig = (config) => {
    // 1. Create the xml file
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
            const xmlDir = path.join(resDir, 'xml');

            if (!fs.existsSync(resDir)) {
                // Return if android dir doesn't exist (e.g., Expo Go)
                return config;
            }

            if (!fs.existsSync(xmlDir)) {
                fs.mkdirSync(xmlDir, { recursive: true });
            }

            // Pinning Firebase/Google APIs
            // Note: These are example pins. In production, these should be the actual base64 encoded hashes of the certificates.
            // Using a dummy pin for demonstration per standard practice until real certs are fetched.
            const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">192.168.10.215</domain>
    </domain-config>
    <domain-config>
        <domain includeSubdomains="true">googleapis.com</domain>
        <domain includeSubdomains="true">firebaseio.com</domain>
        <domain includeSubdomains="true">cloudfunctions.net</domain>
        <domain includeSubdomains="true">exp.host</domain>
        <pin-set expiration="2027-01-01">
            <!-- Replace with actual pins in production -->
            <pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin> 
            <pin digest="SHA-256">BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
        </pin-set>
    </domain-config>
</network-security-config>`;

            fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), networkSecurityConfig);
            return config;
        },
    ]);

    // 2. Add it to AndroidManifest.xml
    config = withAndroidManifest(config, (config) => {
        const androidConfig = config.modResults;
        const application = androidConfig.manifest.application[0];

        application.$['android:networkSecurityConfig'] = '@xml/network_security_config';

        return config;
    });

    return config;
};

module.exports = withNetworkSecurityConfig;
