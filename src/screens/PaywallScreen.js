import { Alert, StatusBar, StyleSheet, View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useUser } from '../context/UserContext';

// 1. REVENUECAT UI PAYWALL
// Documentation: https://www.revenuecat.com/docs/tools/paywalls
export default function PaywallScreen({ navigation }) {
  const { restorePro } = useUser();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <RevenueCatUI.Paywall
        onPurchaseCompleted={({ customerInfo }) => {
          console.log("Purchase Completed:", customerInfo);
          // Check for 'Ruvo Pro' entitlement
          if (customerInfo.entitlements.active['Ruvo Pro']) {
            navigation.goBack(); // Go back to where they were
          }
        }}
        onRestoreCompleted={async ({ customerInfo }) => {
          console.log("Restore Completed:", customerInfo);
          if (customerInfo.entitlements.active['Ruvo Pro']) {
            await restorePro(); // Sync with Context/Firestore
            Alert.alert("Restore Successful", "Your pro subscription has been restored.");
            navigation.goBack();
          } else {
            Alert.alert("Restore Failed", "No active subscription found.");
          }
        }}
        onDismiss={() => {
          navigation.goBack();
        }}
        fontFamily="Poppins-SemiBold"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Fallback
  },
});