module.exports = {
    // Using plain babel-jest instead of jest-expo preset.
    // jest-expo (SDK 54) injects expo/src/winter/runtime.native.ts which
    // intercepts require() calls and breaks module isolation in tests.
    testEnvironment: 'node',
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest'
    },
    transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-purchases)"
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    collectCoverage: true,
    collectCoverageFrom: [
        "src/**/*.{js,jsx,ts,tsx}",
        "!src/**/*.test.{js,jsx,ts,tsx}",
        "!**/node_modules/**"
    ]
};
