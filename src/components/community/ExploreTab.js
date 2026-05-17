import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, memo, useState, useEffect } from 'react';
import { Animated, Dimensions, PanResponder, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from '../Map';
import { COLORS } from '../../constants/legacy-theme.js';
import { lightTap } from '../../utils/haptics';

const { width, height } = Dimensions.get('window');

const DARK_MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
    { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
    { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
    { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];

const RouteItem = memo(({ route, isSelected, onPress }) => (
    <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
            backgroundColor: isSelected ? '#1E2A1E' : '#171717',
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: isSelected ? COLORS.accent + '80' : '#232323',
            flexDirection: 'row',
            alignItems: 'center',
        }}
    >
        <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: isSelected ? COLORS.accent + '20' : '#222',
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
        }}>
            <Ionicons name="navigate" size={20} color={isSelected ? COLORS.accent : '#5AC8FA'} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFF', fontSize: 13, fontFamily: 'Poppins_600SemiBold' }} numberOfLines={1}>{route.title}</Text>
            <Text style={{ color: '#555', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 2 }}>by {route.user || route.userName}</Text>
            {route.stats && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    {[
                        { icon: 'navigate-outline', val: `${route.stats?.km} km` },
                        { icon: 'time-outline', val: route.stats?.time },
                        { icon: 'speedometer-outline', val: `${route.stats?.pace}/km` },
                    ].map(({ icon, val }) => (
                        <View key={icon} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name={icon} size={10} color="#555" />
                            <Text style={{ color: '#888', fontSize: 10, fontFamily: 'Poppins_500Medium', marginLeft: 3 }}>{val}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={{ marginLeft: 8 }} />}
    </TouchableOpacity>
));

const ExploreTab = ({ feedData, selectedRoute, setSelectedRoute, isLoading }) => {
    const SHEET_SNAP_PEEK = 120;
    const SHEET_SNAP_MID  = Math.round(height * 0.45);
    const SHEET_SNAP_FULL = Math.round(height * 0.75);

    const sheetHeight = useRef(new Animated.Value(SHEET_SNAP_MID)).current;
    const sheetHeightRef = useRef(SHEET_SNAP_MID);

    // Defer MapView render so the sheet appears instantly first
    const [mapReady, setMapReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMapReady(true), 200);
        return () => clearTimeout(t);
    }, []);

    const communityRoutes = useMemo(() => {
        return (feedData || [])
            .filter(p => p.routePath && p.routePath.length > 1 && !p.hideMap)
            .slice(0, 15);
    }, [feedData]);

    const snapSheet = (target) => {
        sheetHeightRef.current = target;
        Animated.spring(sheetHeight, { 
            toValue: target, 
            useNativeDriver: false, 
            bounciness: 4 
        }).start();
    };

    const explorePanResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10, // Increased threshold
        onPanResponderMove: (_, g) => {
            const next = sheetHeightRef.current - g.dy;
            sheetHeight.setValue(Math.max(SHEET_SNAP_PEEK, Math.min(SHEET_SNAP_FULL, next)));
        },
        onPanResponderRelease: (_, g) => {
            const current = sheetHeightRef.current - g.dy;
            const snaps = [SHEET_SNAP_PEEK, SHEET_SNAP_MID, SHEET_SNAP_FULL];
            const target = snaps.reduce((a, b) => Math.abs(b - current) < Math.abs(a - current) ? b : a);
            snapSheet(target);
        },
    })).current;

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* MAP — deferred render so the sheet appears instantly */}
            <View style={StyleSheet.absoluteFill}>
                {mapReady && <MapView
                    style={StyleSheet.absoluteFill}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                    customMapStyle={DARK_MAP_STYLE}
                    initialRegion={{ latitude: 33.8938, longitude: 35.5018, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    showsCompass={false}
                >
                    {communityRoutes.map(post => (
                        <Polyline
                            key={post.id}
                            coordinates={post.routePath}
                            strokeColor={selectedRoute?.id === post.id ? '#FFFFFF' : COLORS.accent}
                            strokeWidth={selectedRoute?.id === post.id ? 5 : 2.5}
                            tappable={true}
                            onPress={() => { lightTap(); setSelectedRoute(post); }}
                        />
                    ))}
                    {selectedRoute?.routePath?.length > 0 && (
                        <Marker coordinate={selectedRoute.routePath[0]}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent, borderWidth: 2, borderColor: '#FFF' }} />
                        </Marker>
                    )}
                </MapView>}

                {/* Top badge */}
                <View style={{ position: 'absolute', top: 14, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="navigate-circle" size={15} color={COLORS.accent} />
                        <Text style={{ color: '#FFF', fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginLeft: 6 }}>Community Routes</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginRight: 5 }} />
                        <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'Poppins_500Medium' }}>{communityRoutes.length} route{communityRoutes.length !== 1 ? 's' : ''}</Text>
                    </View>
                </View>
            </View>

            {/* DRAGGABLE BOTTOM SHEET */}
            <Animated.View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: sheetHeight,
                backgroundColor: '#0D0D0D',
                borderTopLeftRadius: 22, borderTopRightRadius: 22,
                borderTopWidth: 1, borderColor: '#222',
            }}>
                {/* Drag handle */}
                <View {...explorePanResponder.panHandlers} style={{ paddingTop: 12, paddingBottom: 10, alignItems: 'center' }}>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
                </View>

                {/* Sheet header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={{ color: '#FFF', fontSize: 15, fontFamily: 'Poppins_700Bold' }}>
                        {selectedRoute ? selectedRoute.title : 'All Routes'}
                    </Text>
                    {selectedRoute && (
                        <TouchableOpacity onPress={() => setSelectedRoute(null)}>
                            <Ionicons name="close-circle" size={22} color="#555" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Route list */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
                    nestedScrollEnabled={true}
                >
                    {isLoading ? (
                        [0, 1, 2].map(i => (
                            <View key={i} style={{ backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#2A2A2A', marginRight: 12 }} />
                                <View style={{ flex: 1, gap: 6 }}>
                                    <View style={{ height: 12, width: '65%', backgroundColor: '#2A2A2A', borderRadius: 6 }} />
                                    <View style={{ height: 10, width: '40%', backgroundColor: '#242424', borderRadius: 6 }} />
                                </View>
                            </View>
                        ))
                    ) : communityRoutes.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingTop: 30 }}>
                            <Ionicons name="map-outline" size={44} color="#2A2A2A" />
                            <Text style={{ color: '#444', marginTop: 10, fontFamily: 'Poppins_500Medium', fontSize: 14, textAlign: 'center' }}>No routes yet</Text>
                            <Text style={{ color: '#333', marginTop: 4, fontFamily: 'Poppins_400Regular', fontSize: 12, textAlign: 'center' }}>Complete a run to add yours to the map!</Text>
                        </View>
                    ) : communityRoutes.map(route => (
                        <RouteItem
                            key={route.id}
                            route={route}
                            isSelected={selectedRoute?.id === route.id}
                            onPress={() => { 
                                lightTap(); 
                                setSelectedRoute(selectedRoute?.id === route.id ? null : route); 
                                snapSheet(SHEET_SNAP_PEEK); 
                            }}
                        />
                    ))}
                </ScrollView>
            </Animated.View>
        </View>
    );
};

export default React.memo(ExploreTab);
