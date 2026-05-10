// Jest setup file for Expo SDK 54
// Prevents the Expo runtime module from intercepting imports during tests

// React Native globals required by modules loaded during tests
global.__DEV__ = true;

// Mock the expo winter runtime that causes "import outside scope" errors
jest.mock('expo/src/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('expo/src/winter/installGlobal', () => ({}), { virtual: true });
