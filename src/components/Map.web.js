import { Text, View } from 'react-native';

const MapView = ({ children, style }) => (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#2C2C2E' }]}>
        <Text style={{ color: '#888', padding: 20, textAlign: 'center' }}>Interactive maps are not supported in the web preview.</Text>
        {/* We do not render children here to avoid rendering map-specific child components that might fail */}
    </View>
);

export const Marker = () => null;
export const Polyline = () => null;
export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = null;

export default MapView;
