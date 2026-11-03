import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { buildMapHtml } from '../map/mapHtml';
import { useTracker } from '../tracking/useTracker';
import type { LatLon } from '../tracking/geo';
import { listInstalledIds } from '../maps/regionStore';
import { closeAllHandles, readSlice } from '../maps/fileReader';
import { Theme } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { FONT } from '../theme/fonts';

const MAP_HTML = buildMapHtml();

const GPS_MEMES = [
  'Пытаемся поймать GPS через фольгу и молитву...',
  'Спутники над нами, но они явно что-то подозревают.',
  'Осторожно, за этой стеной текстуры еще не прогрузились.',
  'Связь с космосом установлена, но марсиане просят перезвонить позже.',
  'Точность GPS: ± километр, держитесь за поручни.',
  'Инициализация терминала... Главное — не нажимать красную кнопку.',
];

type Props = { radiusM: number; onExit: () => void };

export default function MapScreen({ radiusM, onExit }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [memeIndex, setMemeIndex] = useState(0);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [baseMode, setBaseMode] = useState<'offline' | 'online' | null>(null);
  const [baseError, setBaseError] = useState('');
  const [overlayHidden, setOverlayHidden] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const initStarted = useRef(false);
  const initSent = useRef(false);
  const radiusRef = useRef(radiusM);
  radiusRef.current = radiusM;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const send = useCallback((msg: object) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  const tracker = useTracker(true, (p: LatLon, newSegment: boolean) => {
    if (initSent.current) send({ type: 'POINT', lat: p[0], lon: p[1], newSegment });
  });

  // Закрываем файлы карт при выходе с экрана
  useEffect(() => {
    return () => closeAllHandles();
  }, []);

  // Отправляем в карту историю, список скачанных карт и тему
  useEffect(() => {
    if (isMapLoaded && tracker.ready && !initStarted.current) {
      initStarted.current = true;
      (async () => {
        const regions = await listInstalledIds();
        const t = themeRef.current;
        send({
          type: 'INIT',
          segments: tracker.getSegments(),
          radius: radiusRef.current,
          regions,
          theme: { accent: t.accent, fog: t.fog, fogOpacity: t.fogOpacity, dark: t.scheme === 'dark' },
        });
        initSent.current = true;
      })();
    }
  }, [isMapLoaded, tracker.ready]);

  useEffect(() => {
    if (tracker.permissionDenied) {
      Alert.alert('Требуется доступ', 'Без разрешения на геолокацию приложение не сможет открывать туман войны.');
      onExit();
    }
  }, [tracker.permissionDenied]);

  useEffect(() => {
  const sub = AppState.addEventListener('change', (st) => {
    if (st === 'active' && initSent.current) {
      send({ type: 'SET_TRACK', segments: tracker.getSegments() });
    }
  });
  return () => sub.remove();
}, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMemeIndex((prev) => (prev + 1) % GPS_MEMES.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const goodGps = !!tracker.accuracy && tracker.accuracy < 15;

  return (
    <View style={s.container}>
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        style={s.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        overScrollMode="never"
        bounces={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'MAP_LOADED') setIsMapLoaded(true);
            else if (data.type === 'LEAFLET_MISSING') setMapError(true);
            else if (data.type === 'BASE_MODE') setBaseMode(data.mode);
            else if (data.type === 'BASE_ERROR') setBaseError(String(data.message));
            else if (data.type === 'READ') {
              readSlice(data.region, data.offset, data.length)
                .then((b64) => send({ type: 'READ_RESULT', id: data.id, b64 }))
                .catch(() => send({ type: 'READ_ERROR', id: data.id }));
            }
          } catch (e) {}
        }}
      />

      <Pressable style={s.centerBtn} onPress={() => send({ type: 'CENTER' })}>
        <Text style={s.centerBtnText}>⊙</Text>
      </Pressable>

      <View style={[s.topBar, { top: insets.top + 8 }]}>
  <Pressable style={s.menuBtn} onPress={onExit}>
    <Text style={s.menuBtnText}>← Меню</Text>
  </Pressable>

  <View style={s.telemetry}>
    <View style={s.item}>
      <Text style={s.itemTitle}>ПУТЬ</Text>
      <Text style={s.itemValue}>{tracker.distanceKm.toFixed(2)} км</Text>
    </View>
    <View style={s.divider} />
    <View style={s.item}>
      <Text style={s.itemTitle}>СКОРОСТЬ</Text>
      <Text style={s.itemValue}>{tracker.speedKmh} км/ч</Text>
    </View>
    <View style={s.divider} />
    <View style={s.item}>
      <Text style={s.itemTitle}>GPS</Text>
      <Text style={[s.itemValue, { color: goodGps ? theme.accent : theme.textSub }]}>
        {tracker.accuracy ? Math.round(tracker.accuracy) + ' м' : '...'}
      </Text>
    </View>
    {tracker.jumps > 0 && (
      <>
        <View style={s.divider} />
        <View style={s.item}>
          <Text style={s.itemTitle}>ПОМЕХИ</Text>
          <Text style={[s.itemValue, { color: theme.danger }]}>{tracker.jumps}</Text>
        </View>
      </>
    )}
  </View>
</View>

      {(baseMode === 'online' || !!baseError) && (
        <View style={s.banner}>
          <Text style={s.bannerText}>
            {baseError
              ? 'Ошибка карты: ' + baseError
              : 'Офлайн-карта не скачана: карта берётся из интернета. Скачать регион можно в меню «Карты».'}
          </Text>
        </View>
      )}

      {!overlayHidden && (!isMapLoaded || !tracker.hasFix) && (
        <View style={s.overlay}>
          <View style={s.loadingCard}>
            <Text style={s.loadingTitle}>Подготовка карты</Text>
            <Text style={s.meme}>{GPS_MEMES[memeIndex]}</Text>
            <Text style={s.loadingSub}>
              {mapError
                ? 'Не удалось запустить карту.'
                : !isMapLoaded
                  ? 'Загрузка карты...'
                  : 'Калибровка геопозиции (точность: ' +
                    (tracker.accuracy ? Math.round(tracker.accuracy) + ' м' : 'поиск') +
                    ')...'}
            </Text>
            <Pressable onPress={() => setOverlayHidden(true)} style={{ paddingVertical: 10 }}>
              <Text style={{ color: theme.textSub, fontFamily: FONT.medium, fontSize: 13 }}>Скрыть</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    webView: { flex: 1, backgroundColor: t.bg },
    topBar: {
  position: 'absolute',
  left: 12,
  right: 12,
  height: 56,
  flexDirection: 'row',
  gap: 8,
  zIndex: 10,
},
menuBtn: {
  height: 56,
  paddingHorizontal: 14,
  justifyContent: 'center',
  backgroundColor: t.glass,
  borderColor: t.glassBorder,
  borderWidth: 1,
  borderRadius: 20,
},
menuBtnText: { color: t.text, fontFamily: FONT.semibold, fontSize: 13 },
telemetry: {
  flex: 1,
  height: 56,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: t.glass,
  borderColor: t.glassBorder,
  borderWidth: 1,
  borderRadius: 20,
},
item: { flex: 1, alignItems: 'center' },
centerBtn: {
  position: 'absolute',
  bottom: 30,
  right: 12,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: t.glass,
  borderColor: t.glassBorder,
  borderWidth: 1,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
},
    item: { alignItems: 'center', paddingHorizontal: 8 },
    itemTitle: { color: t.textSub, fontFamily: FONT.semibold, fontSize: 9, letterSpacing: 1 },
    itemValue: { color: t.text, fontFamily: FONT.monoBold, fontSize: 13, marginTop: 2 },
    divider: { width: 1, height: 24, backgroundColor: t.divider },
    banner: {
      position: 'absolute',
      bottom: 30,
      left: 12,
      right: 80,
      backgroundColor: t.glass,
      borderColor: t.glassBorder,
      borderWidth: 1,
      borderRadius: 18,
      padding: 10,
      zIndex: 10,
    },
    bannerText: { color: t.textSub, fontFamily: FONT.regular, fontSize: 11 },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.scheme === 'dark' ? 'rgba(16,18,20,0.96)' : 'rgba(238,241,243,0.96)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 20,
      padding: 20,
    },
    loadingCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: t.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: t.cardBorder,
      alignItems: 'center',
    },
    loadingTitle: { color: t.text, fontFamily: FONT.bold, fontSize: 18, marginBottom: 14 },
    meme: { color: t.accent, fontFamily: FONT.medium, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
    loadingSub: { color: t.textSub, fontFamily: FONT.regular, fontSize: 12, textAlign: 'center' },
  });