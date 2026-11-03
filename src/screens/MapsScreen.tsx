import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import type { Region } from '../maps/types';
import { loadCatalog, RegionDownload } from '../maps/downloader';
import { installedSize, removeRegion } from '../maps/regionStore';
import { Theme } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { FONT } from '../theme/fonts';
import { BackPill } from '../ui/kit';

type Props = { onBack: () => void };

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024)) + ' МБ';

export default function MapsScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const [regions, setRegions] = useState<Region[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [installed, setInstalled] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const active = useRef<Record<string, RegionDownload>>({});
  const regionsRef = useRef<Region[]>([]);

  const refresh = useCallback(async () => {
    const map: Record<string, number> = {};
    for (const r of regionsRef.current) {
      const sz = await installedSize(r.id);
      if (sz != null) map[r.id] = sz;
    }
    setInstalled(map);
    try {
      setFreeBytes(await FS.getFreeDiskStorageAsync());
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setRegions(null);
    try {
      const res = await loadCatalog();
      regionsRef.current = res.regions;
      setRegions(res.regions);
      setFromCache(res.fromCache);
      await refresh();
    } catch {
      setLoadFailed(true);
    }
  }, [refresh]);

  useEffect(() => {
    load();
    const downloads = active.current;
    return () => {
      Object.values(downloads).forEach((d) => {
        d.cancel();
      });
    };
  }, [load]);

  const start = async (r: Region) => {
    const need = r.sizeBytes ?? r.sizeMB * 1024 * 1024;
    if (freeBytes != null && freeBytes < need * 1.2) {
      Alert.alert('Недостаточно места', 'Нужно примерно ' + mb(need * 1.2) + ' свободного места.');
      return;
    }
    setErrors((e) => ({ ...e, [r.id]: '' }));
    const d = new RegionDownload(r, (frac) => setProgress((p) => ({ ...p, [r.id]: frac })));
    active.current[r.id] = d;
    setProgress((p) => ({ ...p, [r.id]: 0 }));
    try {
      await d.run();
    } catch {
      setErrors((e) => ({ ...e, [r.id]: 'Не удалось скачать. Проверьте интернет и повторите.' }));
    } finally {
      delete active.current[r.id];
      setProgress((p) => {
        const n = { ...p };
        delete n[r.id];
        return n;
      });
      await refresh();
    }
  };

  const cancel = (r: Region) => {
    active.current[r.id]?.cancel();
  };

  const remove = (r: Region) => {
    Alert.alert('Удалить карту', 'Удалить «' + r.name + '» с телефона?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await removeRegion(r.id);
          await refresh();
        },
      },
    ]);
  };

  let lastGroup = '';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <BackPill onPress={onBack} />
        <Text style={s.title}>Карты</Text>
      </View>

      {freeBytes != null && (
        <Text style={s.free}>Свободно на телефоне: {(freeBytes / 1024 ** 3).toFixed(1)} ГБ</Text>
      )}
      {fromCache && <Text style={s.warn}>Нет связи: показан сохранённый список регионов.</Text>}

      <ScrollView contentContainerStyle={s.list}>
        {regions === null && !loadFailed && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}

        {loadFailed && (
          <View style={s.card}>
            <Text style={s.cardName}>Не удалось загрузить список карт</Text>
            <Text style={s.cardInfo}>Проверьте подключение к интернету.</Text>
            <Pressable style={s.btn} onPress={load}>
              <Text style={s.btnText}>Повторить</Text>
            </Pressable>
          </View>
        )}

        {regions?.map((r) => {
          const showGroup = r.group && r.group !== lastGroup;
          if (r.group) lastGroup = r.group;
          const isDownloading = progress[r.id] !== undefined;
          const isInstalled = installed[r.id] !== undefined;
          return (
            <View key={r.id}>
              {showGroup && <Text style={s.group}>{(r.group ?? '').toUpperCase()}</Text>}
              <View style={s.card}>
                <Text style={s.cardName}>{r.name}</Text>
                <Text style={s.cardInfo}>
                  {r.sizeMB} МБ
                  {isInstalled ? ' · скачано' : ''}
                  {isDownloading ? ' · ' + Math.round(progress[r.id] * 100) + '%' : ''}
                </Text>

                {isDownloading && (
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: Math.round(progress[r.id] * 100) + '%' }]} />
                  </View>
                )}
                {!!errors[r.id] && <Text style={s.error}>{errors[r.id]}</Text>}

                {isDownloading ? (
                  <Pressable style={s.btnSecondary} onPress={() => cancel(r)}>
                    <Text style={s.btnSecondaryText}>Остановить</Text>
                  </Pressable>
                ) : isInstalled ? (
                  <Pressable style={s.btnSecondary} onPress={() => remove(r)}>
                    <Text style={s.btnSecondaryText}>Удалить с телефона</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.btn} onPress={() => start(r)}>
                    <Text style={s.btnText}>Скачать</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, paddingTop: 56 },
    header: { paddingHorizontal: 20, marginBottom: 12, gap: 10 },
    title: { color: t.text, fontFamily: FONT.bold, fontSize: 28 },
    free: { color: t.textMuted, fontFamily: FONT.regular, fontSize: 12, paddingHorizontal: 20, marginBottom: 4 },
    warn: { color: t.accent, fontFamily: FONT.regular, fontSize: 12, paddingHorizontal: 20, marginBottom: 4 },
    list: { padding: 20, paddingBottom: 60 },
    group: { color: t.textSub, fontFamily: FONT.semibold, fontSize: 12, letterSpacing: 1, marginTop: 8, marginBottom: 8 },
    card: {
      backgroundColor: t.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: t.cardBorder,
      padding: 16,
      marginBottom: 12,
    },
    cardName: { color: t.text, fontFamily: FONT.bold, fontSize: 17 },
    cardInfo: { color: t.textSub, fontFamily: FONT.regular, fontSize: 13, marginTop: 4, marginBottom: 12 },
    barBg: { height: 6, backgroundColor: t.divider, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    barFill: { height: 6, backgroundColor: t.accent },
    error: { color: t.danger, fontFamily: FONT.regular, fontSize: 12, marginBottom: 10 },
    btn: { backgroundColor: t.accent, paddingVertical: 14, borderRadius: 18, alignItems: 'center' },
    btnText: { color: t.onAccent, fontFamily: FONT.semibold, fontSize: 15 },
    btnSecondary: {
      backgroundColor: t.accentSoft,
      paddingVertical: 14,
      borderRadius: 18,
      alignItems: 'center',
    },
    btnSecondaryText: { color: t.accent, fontFamily: FONT.semibold, fontSize: 15 },
  });