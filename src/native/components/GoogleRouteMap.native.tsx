import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type MapPressEvent, type MapType, type Region } from 'react-native-maps';
import type { GoogleRoute } from './GoogleRouteMap';
import { colors } from '../theme';

type Props = {
  route: GoogleRoute;
  liveCoordinates?: GoogleRoute['coordinates'];
  focusCoordinate?: GoogleRoute['center'];
  fitRoute?: boolean;
  compactControls?: boolean;
};

const googleDarkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#020617' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B1120' }] }
];

export function GoogleRouteMap({ route, liveCoordinates = [], focusCoordinate, fitRoute = false, compactControls = false }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const userMovedMap = useRef(false);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [drawingMode, setDrawingMode] = useState(false);
  const [plannedCoordinates, setPlannedCoordinates] = useState<GoogleRoute['coordinates']>([]);
  const [threeDimensional, setThreeDimensional] = useState(false);
  const [controlStatus, setControlStatus] = useState('');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLiveRoute = liveCoordinates.length > 1;
  const hasPlannedRoute = plannedCoordinates.length > 1;
  const mapCenter = liveCoordinates[liveCoordinates.length - 1] ?? focusCoordinate ?? route.center;
  const mapDelta = focusCoordinate && liveCoordinates.length === 0 ? 0.006 : 0.032;
  const mapRegion: Region = useMemo(
    () => ({
      latitude: mapCenter.latitude,
      longitude: mapCenter.longitude,
      latitudeDelta: mapDelta,
      longitudeDelta: mapDelta
    }),
    [mapCenter.latitude, mapCenter.longitude, mapDelta]
  );
  const mapModeLabel = mapType === 'hybrid' ? 'H' : mapType === 'standard' ? 'M' : 'S';

  const showStatus = (message: string) => {
    setControlStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setControlStatus(''), 1800);
  };

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  useEffect(() => {
    userMovedMap.current = false;
    if (fitRoute && liveCoordinates.length > 1) {
      mapRef.current?.fitToCoordinates(liveCoordinates, {
        animated: true,
        edgePadding: { top: 90, right: 48, bottom: 280, left: 48 }
      });
      return;
    }
    mapRef.current?.animateToRegion(mapRegion, 520);
  }, [fitRoute, focusCoordinate, liveCoordinates, mapRegion, route.center.latitude, route.center.longitude, route.title]);

  useEffect(() => {
    if (!hasLiveRoute || userMovedMap.current) {
      return;
    }

    mapRef.current?.animateToRegion(mapRegion, 420);
  }, [hasLiveRoute, liveCoordinates.length, mapRegion]);

  const locateUser = async () => {
    try {
      showStatus('Байршил хайж байна...');
      let permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        Alert.alert('Байршлын зөвшөөрөл хэрэгтэй', 'Одоогийн байршлыг харахын тулд location permission өгнө үү.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      userMovedMap.current = false;
      mapRef.current?.animateToRegion(
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.0048,
          longitudeDelta: 0.0048
        },
        520
      );
      showStatus('Таны байршил');
    } catch {
      Alert.alert('Байршил олдсонгүй', 'GPS асаалттай эсэхийг шалгаад дахин оролдоно уу.');
    }
  };

  const toggleMapType = () => {
    const nextType = mapType === 'hybrid' ? 'standard' : mapType === 'standard' ? 'satellite' : 'hybrid';
    setMapType(nextType);
    showStatus(nextType === 'standard' ? 'Энгийн газрын зураг' : nextType === 'satellite' ? 'Хиймэл дагуулын зураг' : 'Хосолсон газрын зураг');
  };

  const toggleThreeDimensional = () => {
    const nextValue = !threeDimensional;
    setThreeDimensional(nextValue);
    showStatus(nextValue ? '3D харагдац' : '2D харагдац');
    mapRef.current?.animateCamera(
      {
        pitch: nextValue ? 58 : 0,
        heading: nextValue ? 18 : 0,
        zoom: nextValue ? 17 : 15
      },
      { duration: 520 }
    );
  };

  const resetOrientation = () => {
    setThreeDimensional(false);
    userMovedMap.current = false;
    mapRef.current?.animateCamera(
      { center: mapCenter, pitch: 0, heading: 0, zoom: 15 },
      { duration: 520 }
    );
    showStatus('Хойд чиглэлд төвлөрлөө');
  };

  const toggleDrawing = () => {
    setDrawingMode(!drawingMode);
    showStatus(drawingMode ? 'Зам зурах горим хаагдлаа' : 'Газрын зураг дээр цэг сонгоно уу');
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (!drawingMode) {
      return;
    }

    const nextCoordinate = event.nativeEvent.coordinate;
    setPlannedCoordinates(currentCoordinates => [...currentCoordinates, nextCoordinate]);
  };

  const undoPlannedPoint = () => {
    setPlannedCoordinates(currentCoordinates => currentCoordinates.slice(0, -1));
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={mapType === 'standard' ? googleDarkMapStyle : undefined}
        initialRegion={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          latitudeDelta: mapDelta,
          longitudeDelta: mapDelta
        }}
        mapType={mapType}
        onPanDrag={() => {
          userMovedMap.current = true;
        }}
        onPress={handleMapPress}
        pitchEnabled
        rotateEnabled
        scrollEnabled
        showsCompass
        showsScale
        showsTraffic
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        zoomControlEnabled
        zoomEnabled
      >
        {hasPlannedRoute ? (
          <>
            <Polyline
              coordinates={plannedCoordinates}
              strokeColor="rgba(0,0,0,0.72)"
              strokeWidth={12}
              lineCap="round"
              lineJoin="round"
              zIndex={24}
            />
            <Polyline
              coordinates={plannedCoordinates}
              strokeColor="#FF5A1F"
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
              zIndex={25}
            />
            <Marker
              coordinate={plannedCoordinates[0]}
              title="Төлөвлөсөн эхлэл"
              pinColor="#FF5A1F"
              zIndex={26}
            />
            <Marker
              coordinate={plannedCoordinates[plannedCoordinates.length - 1]}
              title="Төлөвлөсөн төгсгөл"
              pinColor={colors.accent}
              zIndex={27}
            />
          </>
        ) : null}

        {plannedCoordinates.length === 1 ? (
          <Marker
            coordinate={plannedCoordinates[0]}
            title="Төлөвлөсөн эхлэл"
            pinColor="#FF5A1F"
            zIndex={26}
          />
        ) : null}

        {hasLiveRoute ? (
          <>
            <Polyline
              coordinates={liveCoordinates}
              strokeColor="rgba(0,0,0,0.62)"
              strokeWidth={13}
              lineCap="round"
              lineJoin="round"
              zIndex={29}
            />
            <Polyline
              coordinates={liveCoordinates}
              strokeColor={colors.routeActive}
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
              zIndex={30}
            />
            <Marker
              coordinate={liveCoordinates[0]}
              title="Tracking start"
              pinColor={colors.routeActive}
              zIndex={31}
            />
            <Marker
              coordinate={liveCoordinates[liveCoordinates.length - 1]}
              title="Current location"
              pinColor={colors.routeCompleted}
              zIndex={32}
            />
          </>
        ) : null}
        {focusCoordinate && liveCoordinates.length === 0 ? (
          <Marker
            coordinate={focusCoordinate}
            title="Таны байршил"
            pinColor={colors.routeCompleted}
            zIndex={28}
          />
        ) : null}
      </MapView>

      {compactControls ? null : <View pointerEvents="box-none" style={styles.controls}>
        <Pressable accessibilityLabel="Газрын зургийг төвлөрүүлэх" hitSlop={6} style={styles.compass} onPress={resetOrientation}>
          <Text style={styles.compassNeedle}>▲</Text>
          <Text style={styles.compassText}>N</Text>
        </Pressable>

        <Pressable accessibilityLabel="Газрын зургийн төрөл солих" hitSlop={6} style={styles.controlButton} onPress={toggleMapType}>
          <Text style={styles.mapModeText}>{mapModeLabel}</Text>
        </Pressable>
        <Pressable accessibilityLabel="3D харагдац" hitSlop={6} style={[styles.controlButton, threeDimensional && styles.activeControlButton]} onPress={toggleThreeDimensional}>
          <Text style={styles.controlText}>3D</Text>
        </Pressable>
        <Pressable accessibilityLabel="Миний байршил" hitSlop={6} style={styles.controlButton} onPress={locateUser}>
          <Text style={styles.controlIcon}>⌖</Text>
        </Pressable>
        <Pressable accessibilityLabel="Маршрут зурах" hitSlop={6} style={[styles.controlButton, drawingMode && styles.activeDrawButton]} onPress={toggleDrawing}>
          <Text style={styles.controlIcon}>✎</Text>
        </Pressable>
      </View>}
      {controlStatus ? <View pointerEvents="none" style={styles.controlStatus}><Text style={styles.controlStatusText}>{controlStatus}</Text></View> : null}

      {drawingMode || plannedCoordinates.length > 0 ? (
        <View pointerEvents="box-none" style={styles.drawPanel}>
          <View style={styles.drawPill}>
            <View style={styles.drawLineSample} />
            <Text style={styles.drawText}>
              {drawingMode ? 'Map дээр дарж замаа зур' : `${plannedCoordinates.length} цэгтэй зам`}
            </Text>
          </View>
          {plannedCoordinates.length > 0 ? (
            <View style={styles.drawActions}>
              <Pressable style={styles.drawActionButton} onPress={undoPlannedPoint}>
                <Text style={styles.drawActionText}>Буцах</Text>
              </Pressable>
              <Pressable style={styles.drawActionButton} onPress={() => setPlannedCoordinates([])}>
                <Text style={styles.drawActionText}>Арилгах</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  map: { ...StyleSheet.absoluteFillObject },
  controls: { position: 'absolute', right: 12, bottom: 174, alignItems: 'center', gap: 6, zIndex: 20, elevation: 20 },
  compass: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,17,22,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  compassNeedle: { position: 'absolute', top: 4, color: '#FF5A62', fontSize: 8, fontWeight: '900' },
  compassText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  controlButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,17,22,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 8 },
  activeControlButton: { borderColor: colors.accent, backgroundColor: 'rgba(22,101,52,0.82)' },
  activeDrawButton: { borderColor: '#FF5A1F', backgroundColor: 'rgba(124,45,18,0.88)' },
  controlIcon: { color: '#fff', fontSize: 18, fontWeight: '900' },
  controlText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  mapModeText: { color: colors.accent, fontSize: 14, fontWeight: '900' },
  controlStatus: { position: 'absolute', right: 62, bottom: 174, maxWidth: 190, minHeight: 34, borderRadius: 17, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(5,17,22,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', zIndex: 21, elevation: 21 },
  controlStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  drawPanel: { position: 'absolute', left: 14, right: 64, bottom: 172, gap: 7, zIndex: 19, elevation: 19 },
  drawPill: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(5,17,22,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  drawLineSample: { width: 34, height: 5, borderRadius: 3, backgroundColor: '#FF5A1F' },
  drawText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  drawActions: { flexDirection: 'row', gap: 8 },
  drawActionButton: { alignSelf: 'flex-start', minHeight: 34, borderRadius: 17, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  drawActionText: { color: '#fff', fontSize: 12, fontWeight: '900' }
});
