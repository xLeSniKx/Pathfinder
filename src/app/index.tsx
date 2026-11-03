import React, { useEffect, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MenuScreen from '../screens/MenuScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MapsScreen from '../screens/MapsScreen';
import MapScreen from '../screens/MapScreen';
import { clearTrack, hasSavedTrack } from '../tracking/trackStore';

const RADIUS_KEY = '@fog_radius_m';
const RADIUS_OPTIONS = { normal: 45, wide: 80 } as const;

type Screen = 'menu' | 'settings' | 'map' | 'maps';

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [hasSave, setHasSave] = useState(false);
  const [fogRadius, setFogRadius] = useState<'normal' | 'wide'>('normal');

  useEffect(() => {
    AsyncStorage.getItem(RADIUS_KEY)
      .then((v) => {
        if (v === String(RADIUS_OPTIONS.wide)) setFogRadius('wide');
      })
      .catch(() => {});
  }, []);

  const selectRadius = (kind: 'normal' | 'wide') => {
    setFogRadius(kind);
    AsyncStorage.setItem(RADIUS_KEY, String(RADIUS_OPTIONS[kind])).catch(() => {});
  };

  useEffect(() => {
    if (screen !== 'menu') return;
    hasSavedTrack().then(setHasSave);
  }, [screen]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'menu') {
        setScreen('menu');
        return true;
      }
      return false;
    });
    return () => h.remove();
  }, [screen]);

  const handleNewGame = () => {
    Alert.alert(
      'Новое исследование',
      'Текущий прогресс тумана войны и накопленный трек будут полностью удалены. Начать заново?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: async () => {
            await clearTrack();
            setHasSave(false);
            setScreen('map');
          },
        },
      ]
    );
  };

  if (screen === 'maps') return <MapsScreen onBack={() => setScreen('menu')} />;

  if (screen === 'settings') {
    return <SettingsScreen fogRadius={fogRadius} onRadius={selectRadius} onBack={() => setScreen('menu')} />;
  }

  if (screen === 'map') {
    return <MapScreen radiusM={RADIUS_OPTIONS[fogRadius]} onExit={() => setScreen('menu')} />;
  }

  return (
    <MenuScreen
      hasSave={hasSave}
      onContinue={() => setScreen('map')}
      onNew={handleNewGame}
      onMaps={() => setScreen('maps')}
      onSettings={() => setScreen('settings')}
    />
  );
}