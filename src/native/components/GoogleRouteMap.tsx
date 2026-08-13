import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type GoogleRoute = {
  title: string;
  center: {
    latitude: number;
    longitude: number;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  }[];
};

type Props = {
  route: GoogleRoute;
  liveCoordinates?: GoogleRoute['coordinates'];
  focusCoordinate?: GoogleRoute['center'];
  fitRoute?: boolean;
  compactControls?: boolean;
};

const VIEWBOX_SIZE = 1000;
const MAP_LATITUDE_DELTA = 0.032;
const MAP_LONGITUDE_DELTA = 0.032;

type ScreenPoint = {
  x: number;
  y: number;
};

type WebMapMode = 'hybrid' | 'standard' | 'satellite';

function projectPoint(point: GoogleRoute['coordinates'][number]) {
  const sinLatitude = Math.sin((point.latitude * Math.PI) / 180);

  return {
    x: (point.longitude + 180) / 360,
    y: 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)
  };
}

function getCoordinatePath(route: GoogleRoute, coordinates: GoogleRoute['coordinates']): ScreenPoint[] {
  const center = projectPoint(route.center);
  const northWest = projectPoint({
    latitude: route.center.latitude + MAP_LATITUDE_DELTA / 2,
    longitude: route.center.longitude - MAP_LONGITUDE_DELTA / 2
  });
  const southEast = projectPoint({
    latitude: route.center.latitude - MAP_LATITUDE_DELTA / 2,
    longitude: route.center.longitude + MAP_LONGITUDE_DELTA / 2
  });
  const width = southEast.x - northWest.x || 1;
  const height = southEast.y - northWest.y || 1;

  return coordinates.map(point => {
    const projected = projectPoint(point);

    return {
      x: VIEWBOX_SIZE / 2 + ((projected.x - center.x) / width) * VIEWBOX_SIZE,
      y: VIEWBOX_SIZE / 2 + ((projected.y - center.y) / height) * VIEWBOX_SIZE
    };
  });
}

function getRouteCenter(coordinates: GoogleRoute['coordinates'], fallback: GoogleRoute['center']) {
  if (!coordinates.length) return fallback;
  const totals = coordinates.reduce((sum, point) => ({ latitude: sum.latitude + point.latitude, longitude: sum.longitude + point.longitude }), { latitude: 0, longitude: 0 });
  return { latitude: totals.latitude / coordinates.length, longitude: totals.longitude / coordinates.length };
}

export function GoogleRouteMap({ route, liveCoordinates = [], focusCoordinate, fitRoute = false, compactControls = false }: Props) {
  const [mapMode, setMapMode] = useState<WebMapMode>('hybrid');
  const [drawingMode, setDrawingMode] = useState(false);
  const [plannedCoordinates, setPlannedCoordinates] = useState<GoogleRoute['coordinates']>([]);
  const [browserFocusCoordinate, setBrowserFocusCoordinate] = useState<GoogleRoute['center'] | null>(null);
  const [threeDimensional, setThreeDimensional] = useState(false);
  const [controlStatus, setControlStatus] = useState('');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapCenter = fitRoute ? getRouteCenter(liveCoordinates, route.center) : liveCoordinates[liveCoordinates.length - 1] ?? focusCoordinate ?? route.center;
  const displayedCenter = browserFocusCoordinate ?? mapCenter;
  const mapZoom = fitRoute ? 14 : browserFocusCoordinate || (focusCoordinate && liveCoordinates.length === 0) ? 18 : threeDimensional ? 17 : 15;
  const mapTypeParam = mapMode === 'hybrid' ? '&t=h' : mapMode === 'satellite' ? '&t=k' : '&t=m';
  const url = `https://www.google.com/maps?ll=${displayedCenter.latitude},${displayedCenter.longitude}&z=${mapZoom}${mapTypeParam}&output=embed`;
  const liveRoutePath = getCoordinatePath(route, liveCoordinates);
  const livePoints = liveRoutePath.map(point => `${point.x},${point.y}`).join(' ');
  const liveStartPoint = liveRoutePath[0];
  const liveEndPoint = liveRoutePath[liveRoutePath.length - 1];
  const plannedRoutePath = getCoordinatePath(route, plannedCoordinates);
  const plannedPoints = plannedRoutePath.map(point => `${point.x},${point.y}`).join(' ');
  const plannedStartPoint = plannedRoutePath[0];
  const plannedEndPoint = plannedRoutePath[plannedRoutePath.length - 1];
  const drawingCursor = drawingMode ? 'crosshair' : 'auto';
  const mapModeLabel = mapMode === 'hybrid' ? 'H' : mapMode === 'standard' ? 'M' : 'S';

  const showStatus = (message: string) => {
    setControlStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setControlStatus(''), 1800);
  };

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const toggleMapMode = () => {
    const nextMode = mapMode === 'hybrid' ? 'standard' : mapMode === 'standard' ? 'satellite' : 'hybrid';
    setMapMode(nextMode);
    showStatus(nextMode === 'standard' ? 'Энгийн газрын зураг' : nextMode === 'satellite' ? 'Хиймэл дагуулын зураг' : 'Хосолсон газрын зураг');
  };

  const resetOrientation = () => {
    setThreeDimensional(false);
    setBrowserFocusCoordinate(null);
    showStatus('Маршрутын төвд шилжлээ');
  };

  const toggleThreeDimensional = () => {
    setThreeDimensional(!threeDimensional);
    showStatus(threeDimensional ? '2D харагдац' : '3D харагдац');
  };

  const locateUser = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert('Байршил дэмжигдэхгүй байна', 'Энэ browser байршлын үйлчилгээг дэмжихгүй байна.');
      return;
    }

    showStatus('Байршил хайж байна...');
    navigator.geolocation.getCurrentPosition(
      position => {
        setBrowserFocusCoordinate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        showStatus('Таны байршил');
      },
      () => Alert.alert('Байршил олдсонгүй', 'Browser-ийн location зөвшөөрлийг асаагаад дахин оролдоно уу.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleDrawing = () => {
    setDrawingMode(!drawingMode);
    showStatus(drawingMode ? 'Зам зурах горим хаагдлаа' : 'Газрын зураг дээр цэг сонгоно уу');
  };

  const addPlannedPoint = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    setPlannedCoordinates(currentCoordinates => [
      ...currentCoordinates,
      {
        latitude: displayedCenter.latitude - y * MAP_LATITUDE_DELTA,
        longitude: displayedCenter.longitude + x * MAP_LONGITUDE_DELTA
      }
    ]);
  };

  const controlButtons = (
    <View pointerEvents="box-none" style={styles.controls}>
      <Pressable accessibilityLabel="Газрын зургийг төвлөрүүлэх" hitSlop={6} style={styles.compass} onPress={resetOrientation}>
        <Text style={styles.compassNeedle}>▲</Text>
        <Text style={styles.compassText}>N</Text>
      </Pressable>
      <Pressable accessibilityLabel="Газрын зургийн төрөл солих" hitSlop={6} style={styles.controlButton} onPress={toggleMapMode}>
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
    </View>
  );

  return (
    <View style={styles.root}>
      {React.createElement('iframe' as never, {
        key: url,
        allowFullScreen: true,
        src: url,
        style: {
          ...styles.iframe,
          transform: threeDimensional ? 'perspective(900px) rotateX(12deg) scale(1.12)' : 'none',
          transition: 'transform 360ms ease'
        },
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        title: route.title
      })}
      <View pointerEvents="none" style={styles.embedLinkCover} />
      {React.createElement(
        'svg' as never,
        {
          viewBox: `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`,
          preserveAspectRatio: 'none',
          style: styles.routeOverlay
        },
        React.createElement(
          React.Fragment,
          null,
          plannedRoutePath.length > 1
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement('polyline' as never, {
                  points: plannedPoints,
                  fill: 'none',
                  stroke: 'rgba(0, 0, 0, 0.72)',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeWidth: 34
                }),
                React.createElement('polyline' as never, {
                  points: plannedPoints,
                  fill: 'none',
                  stroke: '#FF5A1F',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeWidth: 20
                }),
                React.createElement('circle' as never, {
                  cx: plannedStartPoint.x,
                  cy: plannedStartPoint.y,
                  fill: '#FF5A1F',
                  r: 25,
                  stroke: '#ffffff',
                  strokeWidth: 7
                }),
                React.createElement('circle' as never, {
                  cx: plannedEndPoint.x,
                  cy: plannedEndPoint.y,
                  fill: colors.accent,
                  r: 25,
                  stroke: '#ffffff',
                  strokeWidth: 7
                })
              )
            : plannedRoutePath.length === 1
              ? React.createElement('circle' as never, {
                  cx: plannedStartPoint.x,
                  cy: plannedStartPoint.y,
                  fill: '#FF5A1F',
                  r: 25,
                  stroke: '#ffffff',
                  strokeWidth: 7
                })
              : null,
          liveRoutePath.length > 1
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement('polyline' as never, {
                points: livePoints,
                fill: 'none',
                stroke: 'rgba(0, 0, 0, 0.62)',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 38
              }),
              React.createElement('polyline' as never, {
                points: livePoints,
                fill: 'none',
                stroke: colors.routeActive,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 22
              }),
              React.createElement('circle' as never, {
                cx: liveStartPoint.x,
                cy: liveStartPoint.y,
                fill: colors.routeActive,
                r: 30,
                stroke: '#ffffff',
                strokeWidth: 9
              }),
              React.createElement('circle' as never, {
                cx: liveEndPoint.x,
                cy: liveEndPoint.y,
                fill: '#ffffff',
                r: 30,
                stroke: colors.routeCompleted,
                strokeWidth: 9
              })
            )
          : null
        )
      )}
      {drawingMode
        ? React.createElement('div' as never, {
            onClick: addPlannedPoint,
            style: { ...styles.drawCapture, cursor: drawingCursor }
          })
        : null}
      {compactControls ? null : controlButtons}
      {controlStatus ? <View pointerEvents="none" style={styles.controlStatus}><Text style={styles.controlStatusText}>{controlStatus}</Text></View> : null}
      {drawingMode || plannedCoordinates.length > 0 ? (
        <View pointerEvents="box-none" style={styles.drawPanel}>
          <View style={styles.drawPill}>
            <View style={styles.drawLineSample} />
            <Text style={styles.drawText}>{drawingMode ? 'Map дээр дарж замаа зур' : `${plannedCoordinates.length} цэгтэй зам`}</Text>
          </View>
          {plannedCoordinates.length > 0 ? (
            <View style={styles.drawActions}>
              <Pressable style={styles.drawActionButton} onPress={() => setPlannedCoordinates(current => current.slice(0, -1))}>
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
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#090d13' },
  iframe: {
    borderWidth: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'auto'
  },
  embedLinkCover: { position: 'absolute', left: 0, top: 0, width: 132, height: 46, backgroundColor: 'rgba(5,17,22,0.96)', zIndex: 3 },
  routeOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    pointerEvents: 'none',
    width: '100%',
    zIndex: 2
  },
  controls: { position: 'absolute', right: 12, bottom: 174, alignItems: 'center', gap: 6, zIndex: 20 },
  compass: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,17,22,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  compassNeedle: { position: 'absolute', top: 4, color: '#FF5A62', fontSize: 8, fontWeight: '900' },
  compassText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  controlButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,17,22,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 8 },
  activeControlButton: { borderColor: colors.accent, backgroundColor: 'rgba(22,101,52,0.82)' },
  activeDrawButton: { borderColor: '#FF5A1F', backgroundColor: 'rgba(124,45,18,0.88)' },
  controlIcon: { color: '#fff', fontSize: 18, fontWeight: '900' },
  controlText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  mapModeText: { color: colors.accent, fontSize: 14, fontWeight: '900' },
  controlStatus: { position: 'absolute', right: 62, bottom: 174, maxWidth: 190, minHeight: 34, borderRadius: 17, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(5,17,22,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', zIndex: 21 },
  controlStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  drawCapture: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 12, backgroundColor: 'rgba(0,0,0,0)' },
  drawPanel: { position: 'absolute', left: 14, right: 64, bottom: 172, gap: 7, zIndex: 19 },
  drawPill: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(5,17,22,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  drawLineSample: { width: 34, height: 5, borderRadius: 3, backgroundColor: '#FF5A1F' },
  drawText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  drawActions: { flexDirection: 'row', gap: 8 },
  drawActionButton: { alignSelf: 'flex-start', minHeight: 34, borderRadius: 17, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  drawActionText: { color: '#fff', fontSize: 12, fontWeight: '900' }
});
