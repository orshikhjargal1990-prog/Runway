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
  showRouteInfo?: boolean;
};

const MAP_LATITUDE_DELTA = 0.032;
const MAP_LONGITUDE_DELTA = 0.032;

type WebMapMode = 'hybrid' | 'standard' | 'satellite';

function getRouteCenter(coordinates: GoogleRoute['coordinates'], fallback: GoogleRoute['center']) {
  if (!coordinates.length) return fallback;
  const totals = coordinates.reduce((sum, point) => ({ latitude: sum.latitude + point.latitude, longitude: sum.longitude + point.longitude }), { latitude: 0, longitude: 0 });
  return { latitude: totals.latitude / coordinates.length, longitude: totals.longitude / coordinates.length };
}

function escapeHtmlJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function GoogleRouteMap({ route, liveCoordinates = [], focusCoordinate, fitRoute = false, compactControls = false, showRouteInfo = true }: Props) {
  const [mapMode, setMapMode] = useState<WebMapMode>('satellite');
  const [drawingMode, setDrawingMode] = useState(false);
  const [plannedCoordinates, setPlannedCoordinates] = useState<GoogleRoute['coordinates']>([]);
  const [browserFocusCoordinate, setBrowserFocusCoordinate] = useState<GoogleRoute['center'] | null>(null);
  const [threeDimensional, setThreeDimensional] = useState(false);
  const [mapHeading, setMapHeading] = useState(0);
  const [controlStatus, setControlStatus] = useState('');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapCenter = fitRoute ? getRouteCenter(liveCoordinates, route.center) : liveCoordinates[liveCoordinates.length - 1] ?? focusCoordinate ?? route.center;
  const displayedCenter = browserFocusCoordinate ?? mapCenter;
  const mapZoom = fitRoute ? 14 : browserFocusCoordinate || (focusCoordinate && liveCoordinates.length === 0) ? 18 : threeDimensional ? 17 : 15;
  const routeCoordinates = route.coordinates ?? [];
  const mapHtml = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #07121A; }
          #map {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 160vmax;
            height: 160vmax;
            background: #07121A;
            transform-origin: 50% 50%;
            transform: translate(-50%, -50%) rotateZ(${mapHeading}deg);
            transition: transform 360ms ease, filter 360ms ease;
          }
          body.three-d #map {
            transform: translate(-50%, -50%) perspective(900px) rotateX(12deg) rotateZ(${mapHeading}deg) scale(1.08);
            filter: saturate(1.16) contrast(1.06);
          }
          .leaflet-control-attribution { display: none; }
          .leaflet-container { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .pin {
            width: 18px;
            height: 18px;
            border-radius: 999px;
            border: 4px solid #fff;
            box-shadow: 0 8px 24px rgba(0,0,0,.42);
          }
          .start { background: ${colors.accent}; border-color: #FFFFFF; }
          .finish { background: #FFFFFF; border-color: ${colors.accent}; }
          .live { width: 20px; height: 20px; background: ${colors.routeCompleted}; }
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
            background: ${colors.accent};
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
      <body class="${threeDimensional ? 'three-d' : ''}">
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = ${escapeHtmlJson(displayedCenter)};
          const route = ${escapeHtmlJson(routeCoordinates)};
          const live = ${escapeHtmlJson(liveCoordinates)};
          const planned = ${escapeHtmlJson(plannedCoordinates)};
          const routeTitle = ${escapeHtmlJson(route.title)};
          const routeCenter = ${escapeHtmlJson(route.center)};
          const showRouteInfo = ${showRouteInfo ? 'true' : 'false'};
          const mapMode = '${mapMode}';
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
          const map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            tap: true,
            touchZoom: true,
            dragging: true,
            scrollWheelZoom: true
          }).setView([center.latitude, center.longitude], ${mapZoom});
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
          L.tileLayer(tileUrl, { maxZoom: 19, detectRetina: true }).addTo(map);
          map.createPane('runboostRouteOverlay');
          map.getPane('runboostRouteOverlay').style.zIndex = 660;
          map.getPane('runboostRouteOverlay').style.pointerEvents = 'none';
          map.createPane('runboostPointOverlay');
          map.getPane('runboostPointOverlay').style.zIndex = 670;
          map.getPane('runboostPointOverlay').style.pointerEvents = 'none';
          const toLatLngs = points => points.map(point => [point.latitude, point.longitude]);
          const lineLayers = [];
          const pointLayers = [];
          const labelElements = [];
          const scaledWeight = (base) => {
            const zoom = map.getZoom();
            const scale = Math.max(0.42, Math.min(1.12, 1 - (15 - zoom) * 0.16));
            return Math.max(2, Math.round(base * scale));
          };
          const scaledPointRadius = (base) => {
            const zoom = map.getZoom();
            const scale = Math.max(0.32, Math.min(1, 1 - (15 - zoom) * 0.2));
            return Math.max(3, Math.round(base * scale));
          };
          const addScaledLine = (latLngs, options) => {
            const layer = L.polyline(latLngs, { ...options, pane: 'runboostRouteOverlay', interactive: false, weight: scaledWeight(options.baseWeight) }).addTo(map);
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
          const routeLatLngs = toLatLngs(route);
          const liveLatLngs = toLatLngs(live);
          const plannedLatLngs = toLatLngs(planned);
          const escapeLabel = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
          const addPoint = (latLng, options) => {
            const layer = L.circleMarker(latLng, {
              pane: 'runboostPointOverlay',
              interactive: false,
              radius: scaledPointRadius(options.radius),
              color: options.stroke,
              weight: 3,
              opacity: 1,
              fillColor: options.fill,
              fillOpacity: 1
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

          if (routeLatLngs.length > 1) {
            addScaledLine(routeLatLngs, { color: '${colors.accent}', baseWeight: 10, opacity: 1, lineCap: 'round', lineJoin: 'round' });
            if (!liveLatLngs.length) {
              addPoint(routeLatLngs[0], { fill: '${colors.accent}', stroke: '#FFFFFF', radius: 9 });
              addPoint(routeLatLngs[routeLatLngs.length - 1], { fill: '#FFFFFF', stroke: '${colors.accent}', radius: 9 });
            }
          }

          if (plannedLatLngs.length > 1) {
            addScaledLine(plannedLatLngs, { color: '#FF5A1F', baseWeight: 8, opacity: 1, lineCap: 'round', lineJoin: 'round' });
          }

          if (liveLatLngs.length > 1) {
            addScaledLine(liveLatLngs, { color: '${colors.routeActive}', baseWeight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round' });
            addPoint(liveLatLngs[0], { fill: '${colors.routeActive}', stroke: '#FFFFFF', radius: 8 });
            addPoint(liveLatLngs[liveLatLngs.length - 1], { fill: '${colors.routeCompleted}', stroke: '#FFFFFF', radius: 10 });
          }
          addRouteNameLabel();

          const fitLatLngs = ${fitRoute ? 'true' : 'false'} && (liveLatLngs.length > 1 ? liveLatLngs : routeLatLngs);
          if (fitLatLngs && fitLatLngs.length > 1) {
            map.fitBounds(fitLatLngs, { padding: [58, 58], maxZoom: 16 });
          }
          refreshLineWeights();
          map.on('zoomend', refreshLineWeights);

          let heading = ${mapHeading};
          let rotateGesture = null;
          const touchAngle = touches => Math.atan2(
            touches[1].clientY - touches[0].clientY,
            touches[1].clientX - touches[0].clientX
          ) * 180 / Math.PI;
          const applyHeading = animated => {
            if (!mapElement) return;
            mapElement.style.transition = animated ? 'transform 360ms ease, filter 360ms ease' : 'none';
            mapElement.style.transform = document.body.classList.contains('three-d')
              ? 'translate(-50%, -50%) perspective(900px) rotateX(12deg) rotateZ(' + heading + 'deg) scale(1.08)'
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
    setMapHeading(0);
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
        key: `${mapMode}-${threeDimensional ? '3d' : '2d'}-${mapHeading}-${displayedCenter.latitude}-${displayedCenter.longitude}-${routeCoordinates.length}-${liveCoordinates.length}-${plannedCoordinates.length}-${fitRoute ? 'fit' : 'free'}`,
        allowFullScreen: true,
        srcDoc: mapHtml,
        style: {
          ...styles.iframe
        },
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        title: route.title
      })}
      <View pointerEvents="none" style={styles.embedLinkCover} />
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
