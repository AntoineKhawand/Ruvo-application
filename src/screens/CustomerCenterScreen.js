import { StyleSheet, View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

// 2. REVENUECAT UI CUSTOMER CENTER
// Documentation: https://www.revenuecat.com/docs/tools/customer-center
export default function CustomerCenterScreen() {
    return (
        <View style={styles.container}>
            <RevenueCatUI.CustomerCenter />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});
