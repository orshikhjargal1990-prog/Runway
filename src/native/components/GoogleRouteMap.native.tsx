import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, type MapPressEvent, type MapType, type Region } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GoogleRoute } from './GoogleRouteMap';
import { colors } from '../theme';

type Props = {
  route: GoogleRoute;
  liveCoordinates?: GoogleRoute['coordinates'];
  focusCoordinate?: GoogleRoute['center'];
  fitRoute?: boolean;
  compactControls?: boolean;
  showRouteInfo?: boolean;
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

const hasGoogleMapsApiKey = Boolean(
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
);

function getRouteStrokeScale(longitudeDelta: number) {
  const scale = Math.sqrt(0.032 / Math.max(0.004, longitudeDelta));
  return Math.max(0.45, Math.min(1.18, scale));
}

export function GoogleRouteMap({ route, liveCoordinates = [], focusCoordinate, fitRoute = false, compactControls = false, showRouteInfo = true }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const fallbackMapRef = useRef<WebView | null>(null);
  const insets = useSafeAreaInsets();
  const userMovedMap = useRef(false);
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [drawingMode] = useState(false);
  const [plannedCoordinates, setPlannedCoordinates] = useState<GoogleRoute['coordinates']>([]);
  const [threeDimensional, setThreeDimensional] = useState(false);
  const [controlStatus, setControlStatus] = useState('');
  const [mapHeading, setMapHeading] = useState(0);
  const [routeStrokeScale, setRouteStrokeScale] = useState(() => getRouteStrokeScale(0.032));
  const [locatedCoordinate, setLocatedCoordinate] = useState<GoogleRoute['center'] | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLiveRoute = liveCoordinates.length > 1;
  const routeCoordinates = route.coordinates ?? [];
  const hasRoutePath = routeCoordinates.length > 1;
  const hasPlannedRoute = plannedCoordinates.length > 1;
  const mapCenter = liveCoordinates[liveCoordinates.length - 1] ?? focusCoordinate ?? route.center;
  const fallbackRouteCoordinates = liveCoordinates.length > 1 ? liveCoordinates : routeCoordinates;
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
  const routePointRadius = Math.max(8, 18 * routeStrokeScale);
  const livePointRadius = Math.max(8, 20 * routeStrokeScale);
  const routePointStroke = Math.max(2, 3 * routeStrokeScale);
  const routeLabelScale = Math.max(0.52, Math.min(1, routeStrokeScale));
  const controlBottomOffset = Math.max(170, insets.bottom + 142);
  const routeFitKey = routeCoordinates.map(point => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`).join('|');

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
    if (!focusCoordinate && liveCoordinates.length === 0 && hasRoutePath) {
      const fitSelectedRoute = () => {
        mapRef.current?.fitToCoordinates(routeCoordinates, {
          animated: true,
          edgePadding: { top: 120, right: 58, bottom: 150, left: 58 }
        });
      };

      fitSelectedRoute();
      const fitTimer = setTimeout(fitSelectedRoute, 260);
      return () => clearTimeout(fitTimer);
    }
    const regionTimer = setTimeout(() => {
      mapRef.current?.animateToRegion(mapRegion, 520);
    }, 60);
    return () => clearTimeout(regionTimer);
  }, [fitRoute, focusCoordinate, hasRoutePath, liveCoordinates, mapRegion, route.center.latitude, route.center.longitude, route.title, routeCoordinates, routeFitKey]);

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
      const nextLocatedCoordinate = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      };

      userMovedMap.current = false;
      setLocatedCoordinate(nextLocatedCoordinate);
      fallbackMapRef.current?.injectJavaScript(`
        if (window.runboostMap) {
          window.runboostMap.setView([${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}], 17, { animate: true });
        }
        if (window.runboostSetUserLocation) {
          window.runboostSetUserLocation(${currentLocation.coords.latitude}, ${currentLocation.coords.longitude});
        }
        true;
      `);
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
    fallbackMapRef.current?.injectJavaScript(`
      document.body.classList.toggle('three-d', ${nextValue ? 'true' : 'false'});
      const mapElement = document.getElementById('map');
      if (mapElement) {
        mapElement.style.transform = ${nextValue ? `'translate(-50%, -50%) perspective(900px) rotateX(18deg) rotateZ(${mapHeading}deg) scale(1.08)'` : `'translate(-50%, -50%) rotateZ(${mapHeading}deg)'`};
      }
      true;
    `);
    mapRef.current?.animateCamera(
      {
        pitch: nextValue ? 58 : 0,
        zoom: nextValue ? 17 : 15
      },
      { duration: 520 }
    );
  };

  const resetOrientation = () => {
    setThreeDimensional(false);
    setMapHeading(0);
    userMovedMap.current = false;
    fallbackMapRef.current?.injectJavaScript(`
      document.body.classList.remove('three-d');
      const mapElement = document.getElementById('map');
      if (mapElement) {
        mapElement.style.transform = 'translate(-50%, -50%) rotateZ(0deg)';
      }
      if (window.runboostMap) {
        window.runboostMap.setView([${mapCenter.latitude}, ${mapCenter.longitude}], 15, { animate: true });
      }
      true;
    `);
    mapRef.current?.animateCamera(
      { center: mapCenter, pitch: 0, heading: 0, zoom: 15 },
      { duration: 520 }
    );
    showStatus('Хойд чиглэлд төвлөрлөө');
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

  if (!hasGoogleMapsApiKey) {
    const currentPoint = liveCoordinates[liveCoordinates.length - 1] ?? focusCoordinate ?? route.center;
    const fallbackMapHtml = `
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            html, body { height: 100%; width: 100%; margin: 0; background: #07121A; overflow: hidden; }
            #map {
              position: absolute;
              left: 50%;
              top: 50%;
              height: 160vmax;
              width: 160vmax;
              background: #07121A;
              transform-origin: 50% 50%;
              transform: translate(-50%, -50%) rotateZ(${mapHeading}deg);
              transition: transform 380ms ease, filter 380ms ease;
            }
            body.three-d #map {
              transform: translate(-50%, -50%) perspective(900px) rotateX(18deg) rotateZ(${mapHeading}deg) scale(1.08);
              filter: saturate(1.14) contrast(1.04);
            }
            .leaflet-control-attribution { display: none; }
            .leaflet-control-zoom { border: 0 !important; box-shadow: 0 12px 28px rgba(0,0,0,.28); }
            .leaflet-control-zoom a {
              width: 38px !important;
              height: 38px !important;
              line-height: 38px !important;
              color: #fff !important;
              background: rgba(5,17,22,.84) !important;
              border-color: rgba(255,255,255,.18) !important;
            }
            .pin {
              width: 18px;
              height: 18px;
              border-radius: 999px;
              border: 4px solid #fff;
              box-shadow: 0 8px 24px rgba(0,0,0,.42);
            }
            .start { background: #FF5A1F; }
            .end { background: #39FF88; }
            .live { width: 20px; height: 20px; background: #46C7FF; }
            .route-name-label {
              display: inline-flex;
              align-items: center;
              gap: 7px;
              width: max-content;
              max-width: 210px;
              padding: 8px 10px;
              border-radius: 14px;
              background: rgba(5,17,22,.9);
              border: 1px solid rgba(255,255,255,.22);
              box-shadow: 0 12px 28px rgba(0,0,0,.34);
              color: #fff;
              font-size: 11px;
              font-weight: 900;
              line-height: 1.15;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .route-name-pin {
              width: 15px;
              height: 15px;
              border-radius: 999px 999px 999px 3px;
              transform: rotate(-45deg);
              background: #B7FF2A;
              border: 2px solid #fff;
              flex: none;
            }
            .route-name-label span {
              min-width: 0;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            const center = ${JSON.stringify(currentPoint)};
            const route = ${JSON.stringify(fallbackRouteCoordinates)};
            const live = ${JSON.stringify(liveCoordinates)};
            const routeTitle = ${JSON.stringify(route.title)};
            const routeCenter = ${JSON.stringify(route.center)};
            const showRouteInfo = ${showRouteInfo ? 'true' : 'false'};
            const mapMode = '${mapType}';
            const tileUrl = mapMode === 'satellite'
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : mapMode === 'hybrid'
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            const mapElement = document.getElementById('map');
            const resizeMapCanvas = () => {
              if (!mapElement) return;
              const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 360;
              const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
              const side = Math.ceil(Math.hypot(viewportWidth, viewportHeight) * 1.18);
              mapElement.style.width = side + 'px';
              mapElement.style.height = side + 'px';
            };
            resizeMapCanvas();
            const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([center.latitude, center.longitude], ${fitRoute ? 14 : 15});
            window.runboostMap = map;
            window.setTimeout(() => map.invalidateSize(), 80);
            window.addEventListener('resize', () => {
              resizeMapCanvas();
              window.setTimeout(() => map.invalidateSize(), 60);
            });
            window.addEventListener('orientationchange', () => {
              window.setTimeout(() => {
                resizeMapCanvas();
                map.invalidateSize();
              }, 120);
            });
            L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
            map.createPane('runboostRouteOverlay');
            map.getPane('runboostRouteOverlay').style.zIndex = 660;
            map.getPane('runboostRouteOverlay').style.pointerEvents = 'none';
            map.createPane('runboostPointOverlay');
            map.getPane('runboostPointOverlay').style.zIndex = 670;
            map.getPane('runboostPointOverlay').style.pointerEvents = 'none';
            const latLngs = route.map(point => [point.latitude, point.longitude]);
            const pointLayers = [];
            const labelElements = [];
            const escapeLabel = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
            const scaledPointRadius = (base) => {
              const zoom = map.getZoom();
              const scale = Math.max(0.32, Math.min(1, 1 - (15 - zoom) * 0.2));
              return Math.max(3, Math.round(base * scale));
            };
            const addPoint = (latLng, options) => {
              const layer = L.circleMarker(latLng, {
                pane: 'runboostPointOverlay',
                interactive: false,
                radius: scaledPointRadius(options.radius),
                color: options.stroke,
                weight: 3,
                opacity: 1,
                fillColor: options.fill,
                fillOpacity: options.opacity ?? 1
              }).addTo(map);
              pointLayers.push({ layer, baseRadius: options.radius });
            };
            const addRouteNameLabel = () => {
              if (!showRouteInfo || !routeTitle) return;
              const label = L.divIcon({
                className: '',
                html: '<div class="route-name-label"><i class="route-name-pin"></i><span>' + escapeLabel(routeTitle) + '</span></div>',
                iconSize: null,
                iconAnchor: [18, 44]
              });
              L.marker([routeCenter.latitude, routeCenter.longitude], {
                icon: label,
                pane: 'runboostPointOverlay',
                interactive: false,
                keyboard: false
              }).addTo(map).on('add', event => {
                const element = event.target.getElement()?.querySelector('.route-name-label');
                if (element) {
                  labelElements.push(element);
                  refreshLineWeights();
                }
              });
            };
            const lineLayers = [];
            const scaledWeight = (base) => {
              const zoom = map.getZoom();
              const scale = Math.max(0.42, Math.min(1.12, 1 - (15 - zoom) * 0.16));
              return Math.max(2, Math.round(base * scale));
            };
            const addScaledLine = (points, options) => {
              const layer = L.polyline(points, { ...options, pane: 'runboostRouteOverlay', interactive: false, weight: scaledWeight(options.baseWeight) }).addTo(map);
              lineLayers.push({ layer, baseWeight: options.baseWeight });
              return layer;
            };
            const refreshLineWeights = () => {
              lineLayers.forEach(item => item.layer.setStyle({ weight: scaledWeight(item.baseWeight) }));
              pointLayers.forEach(item => item.layer.setStyle({ radius: scaledPointRadius(item.baseRadius), weight: Math.max(2, Math.round(3 * Math.max(0.55, scaledPointRadius(item.baseRadius) / item.baseRadius))) }));
              const labelScale = Math.max(0.48, Math.min(1, scaledPointRadius(10) / 10));
              labelElements.forEach(element => {
                element.style.transformOrigin = '0 100%';
                element.style.transform = 'scale(' + labelScale + ')';
              });
            };
            if (latLngs.length > 1) {
              addScaledLine(latLngs, { color: '#B7FF2A', baseWeight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' });
              if (live.length > 1) {
                const liveLatLngs = live.map(point => [point.latitude, point.longitude]);
                addScaledLine(liveLatLngs, { color: '#46C7FF', baseWeight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' });
              }
              map.fitBounds(latLngs, { paddingTopLeft: [58, 120], paddingBottomRight: [58, 150], maxZoom: 16 });
            }
            refreshLineWeights();
            map.on('zoomend', refreshLineWeights);
            if (latLngs.length) addPoint(latLngs[0], { fill: '#B7FF2A', stroke: '#FFFFFF', radius: 9 });
            if (latLngs.length > 1) addPoint(latLngs[latLngs.length - 1], { fill: '#FFFFFF', stroke: '#B7FF2A', radius: 9 });
            if (live.length) {
              const last = live[live.length - 1];
              window.runboostLiveMarker = L.circleMarker([last.latitude, last.longitude], { pane: 'runboostPointOverlay', interactive: false, radius: scaledPointRadius(10), color: '#FFFFFF', weight: 3, fillColor: '#46C7FF', fillOpacity: 1 }).addTo(map);
            } else {
              window.runboostLiveMarker = L.circleMarker([center.latitude, center.longitude], { pane: 'runboostPointOverlay', interactive: false, radius: scaledPointRadius(10), color: '#FFFFFF', weight: 3, fillColor: '#46C7FF', fillOpacity: 0, opacity: 0 }).addTo(map);
            }
            window.runboostUserLocationMarker = null;
            window.runboostSetUserLocation = (latitude, longitude) => {
              const latLng = [latitude, longitude];
              if (window.runboostUserLocationMarker && window.runboostUserLocationMarker.setLatLng) {
                window.runboostUserLocationMarker.setLatLng(latLng);
                window.runboostUserLocationMarker.setStyle({ opacity: 1, fillOpacity: 1 });
                return;
              }
              window.runboostUserLocationMarker = L.circleMarker(latLng, {
                pane: 'runboostPointOverlay',
                interactive: false,
                radius: scaledPointRadius(9),
                color: '#FFFFFF',
                weight: 3,
                fillColor: '#B7FF2A',
                fillOpacity: 1,
                opacity: 1
              }).addTo(map);
              pointLayers.push({ layer: window.runboostUserLocationMarker, baseRadius: 9 });
            };
            addRouteNameLabel();

            let heading = ${mapHeading};
            let rotateGesture = null;
            const touchAngle = touches => Math.atan2(
              touches[1].clientY - touches[0].clientY,
              touches[1].clientX - touches[0].clientX
            ) * 180 / Math.PI;
            const applyHeading = animated => {
              if (!mapElement) return;
              mapElement.style.transition = animated ? 'transform 380ms ease, filter 380ms ease' : 'none';
              mapElement.style.transform = document.body.classList.contains('three-d')
                ? 'translate(-50%, -50%) perspective(900px) rotateX(18deg) rotateZ(' + heading + 'deg) scale(1.08)'
                : 'translate(-50%, -50%) rotateZ(' + heading + 'deg)';
            };
            mapElement?.addEventListener('touchstart', event => {
              if (event.touches.length === 2) {
                rotateGesture = { angle: touchAngle(event.touches), heading };
                applyHeading(false);
              }
            }, { passive: true });
            mapElement?.addEventListener('touchmove', event => {
              if (event.touches.length === 2 && rotateGesture) {
                heading = (rotateGesture.heading + touchAngle(event.touches) - rotateGesture.angle + 360) % 360;
                applyHeading(false);
              }
            }, { passive: true });
            mapElement?.addEventListener('touchend', event => {
              if (event.touches.length < 2) {
                rotateGesture = null;
                applyHeading(true);
              }
            }, { passive: true });
          </script>
        </body>
      </html>
    `;

    return (
      <View style={styles.fallbackRoot}>
        <WebView
          ref={fallbackMapRef}
          key={`${mapType}-${fitRoute ? 'fit' : 'free'}-${route.title}-${routeFitKey}-${fallbackRouteCoordinates.length}-${liveCoordinates.length}`}
          originWhitelist={['*']}
          source={{ html: fallbackMapHtml }}
          style={styles.webMap}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled
          nestedScrollEnabled
        />
        <View pointerEvents="none" style={styles.fallbackScrim} />
        {compactControls ? null : (
          <View pointerEvents="box-none" style={[styles.controls, { bottom: controlBottomOffset }]}>
            <Pressable accessibilityLabel="Газрын зургийг төвлөрүүлэх" hitSlop={12} style={styles.compass} onPress={resetOrientation}>
              <Text style={styles.compassNeedle}>▲</Text>
              <Text style={styles.compassText}>N</Text>
            </Pressable>
            <Pressable accessibilityLabel="Газрын зургийн төрөл солих" hitSlop={12} style={styles.controlButton} onPress={toggleMapType}>
              <Text style={styles.mapModeText}>{mapModeLabel}</Text>
            </Pressable>
            <Pressable accessibilityLabel="3D харагдац" hitSlop={12} style={[styles.controlButton, threeDimensional && styles.activeControlButton]} onPress={toggleThreeDimensional}>
              <Text style={styles.controlText}>3D</Text>
            </Pressable>
            <Pressable accessibilityLabel="Миний байршил" hitSlop={12} style={styles.controlButton} onPress={locateUser}>
              <Text style={styles.controlIcon}>⌖</Text>
            </Pressable>
          </View>
        )}
        {controlStatus ? <View pointerEvents="none" style={[styles.controlStatus, { bottom: controlBottomOffset + 152 }]}><Text style={styles.controlStatusText}>{controlStatus}</Text></View> : null}
      </View>
    );
  }

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
        onRegionChangeComplete={region => {
          setRouteStrokeScale(getRouteStrokeScale(region.longitudeDelta));
        }}
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
              strokeColor="#FF5A1F"
              strokeWidth={Math.max(2, 4.5 * routeStrokeScale)}
              lineCap="round"
              lineJoin="round"
              zIndex={125}
            />
            <Circle
              center={plannedCoordinates[0]}
              radius={routePointRadius}
              strokeColor="#FFFFFF"
              strokeWidth={routePointStroke}
              fillColor="#FF5A1F"
              zIndex={126}
            />
            <Circle
              center={plannedCoordinates[plannedCoordinates.length - 1]}
              radius={routePointRadius}
              strokeColor="#FFFFFF"
              strokeWidth={routePointStroke}
              fillColor={colors.accent}
              zIndex={127}
            />
          </>
        ) : null}

        {!hasPlannedRoute && hasRoutePath ? (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.accent}
              strokeWidth={Math.max(2, 5 * routeStrokeScale)}
              lineCap="round"
              lineJoin="round"
              zIndex={119}
            />
            {!hasLiveRoute ? (
              <>
                <Circle
                  center={routeCoordinates[0]}
                  radius={routePointRadius}
                  strokeColor="#FFFFFF"
                  strokeWidth={routePointStroke}
                  fillColor={colors.accent}
                  zIndex={120}
                />
                <Circle
                  center={routeCoordinates[routeCoordinates.length - 1]}
                  radius={routePointRadius}
                  strokeColor={colors.accent}
                  strokeWidth={routePointStroke}
                  fillColor="#FFFFFF"
                  zIndex={121}
                />
              </>
            ) : null}
          </>
        ) : null}

        {plannedCoordinates.length === 1 ? (
          <Circle
            center={plannedCoordinates[0]}
            radius={routePointRadius}
            strokeColor="#FFFFFF"
            strokeWidth={routePointStroke}
            fillColor="#FF5A1F"
            zIndex={126}
          />
        ) : null}

        {hasLiveRoute ? (
          <>
            <Polyline
              coordinates={liveCoordinates}
              strokeColor={colors.routeActive}
              strokeWidth={Math.max(2, 5 * routeStrokeScale)}
              lineCap="round"
              lineJoin="round"
              zIndex={130}
            />
            <Circle
              center={liveCoordinates[0]}
              radius={routePointRadius}
              strokeColor="#FFFFFF"
              strokeWidth={routePointStroke}
              fillColor={colors.routeActive}
              zIndex={131}
            />
            <Circle
              center={liveCoordinates[liveCoordinates.length - 1]}
              radius={livePointRadius}
              strokeColor="#FFFFFF"
              strokeWidth={routePointStroke}
              fillColor={colors.routeCompleted}
              zIndex={132}
            />
          </>
        ) : null}
        {showRouteInfo ? (
          <Marker
            coordinate={route.center}
            anchor={{ x: 0.08, y: 1 }}
            tracksViewChanges={false}
            zIndex={150}
          >
            <View style={[styles.routeNameMarker, { transform: [{ scale: routeLabelScale }] }]}>
              <View style={styles.routeNamePin} />
              <Text style={styles.routeNameText} numberOfLines={1}>{route.title}</Text>
            </View>
          </Marker>
        ) : null}
        {locatedCoordinate ? (
          <Marker
            coordinate={locatedCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={160}
          >
            <View style={[styles.locatedDotWrap, { transform: [{ scale: routeLabelScale }] }]}>
              <View style={styles.locatedDot} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {compactControls ? null : <View pointerEvents="box-none" style={[styles.controls, { bottom: controlBottomOffset }]}>
        <Pressable accessibilityLabel="Газрын зургийг төвлөрүүлэх" hitSlop={12} style={styles.compass} onPress={resetOrientation}>
          <Text style={styles.compassNeedle}>▲</Text>
          <Text style={styles.compassText}>N</Text>
        </Pressable>

        <Pressable accessibilityLabel="Газрын зургийн төрөл солих" hitSlop={12} style={styles.controlButton} onPress={toggleMapType}>
          <Text style={styles.mapModeText}>{mapModeLabel}</Text>
        </Pressable>
        <Pressable accessibilityLabel="3D харагдац" hitSlop={12} style={[styles.controlButton, threeDimensional && styles.activeControlButton]} onPress={toggleThreeDimensional}>
          <Text style={styles.controlText}>3D</Text>
        </Pressable>
        <Pressable accessibilityLabel="Миний байршил" hitSlop={12} style={styles.controlButton} onPress={locateUser}>
          <Text style={styles.controlIcon}>⌖</Text>
        </Pressable>
      </View>}
      {controlStatus ? <View pointerEvents="none" style={[styles.controlStatus, { bottom: controlBottomOffset + 152 }]}><Text style={styles.controlStatusText}>{controlStatus}</Text></View> : null}

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
  fallbackRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07121A', overflow: 'hidden' },
  webMap: { ...StyleSheet.absoluteFillObject, backgroundColor: '#07121A' },
  fallbackScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,11,26,0.08)' },
  routeNameMarker: {
    maxWidth: 220,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(5,17,22,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 8
  },
  routeNamePin: {
    width: 15,
    height: 15,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    borderBottomLeftRadius: 3,
    transform: [{ rotate: '-45deg' }],
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  routeNameText: { minWidth: 0, maxWidth: 175, color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  locatedDotWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,255,42,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8
  },
  locatedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: '#FFFFFF'
  },
  controls: { position: 'absolute', right: 14, alignItems: 'center', gap: 8, zIndex: 40, elevation: 40 },
  compass: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,12,18,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', shadowColor: '#000', shadowOpacity: 0.26, shadowRadius: 10 },
  compassNeedle: { position: 'absolute', top: 4, color: '#FF5A62', fontSize: 8, fontWeight: '900' },
  compassText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  controlButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,12,18,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', shadowColor: '#000', shadowOpacity: 0.26, shadowRadius: 10 },
  activeControlButton: { borderColor: colors.accent, backgroundColor: 'rgba(22,101,52,0.82)' },
  activeDrawButton: { borderColor: '#FF5A1F', backgroundColor: 'rgba(124,45,18,0.88)' },
  controlIcon: { color: '#fff', fontSize: 18, fontWeight: '900' },
  controlText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  mapModeText: { color: colors.accent, fontSize: 14, fontWeight: '900' },
  controlStatus: { position: 'absolute', right: 66, maxWidth: 190, minHeight: 34, borderRadius: 17, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(4,12,18,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', zIndex: 41, elevation: 41 },
  controlStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  drawPanel: { position: 'absolute', left: 14, right: 64, bottom: 172, gap: 7, zIndex: 19, elevation: 19 },
  drawPill: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(5,17,22,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  drawLineSample: { width: 34, height: 5, borderRadius: 3, backgroundColor: '#FF5A1F' },
  drawText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  drawActions: { flexDirection: 'row', gap: 8 },
  drawActionButton: { alignSelf: 'flex-start', minHeight: 34, borderRadius: 17, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  drawActionText: { color: '#fff', fontSize: 12, fontWeight: '900' }
});
