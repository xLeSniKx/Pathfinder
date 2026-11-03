import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { FONT } from '../theme/fonts';
import { Button } from '../ui/kit';

type Props = {
  hasSave: boolean;
  onContinue: () => void;
  onNew: () => void;
  onMaps: () => void;
  onSettings: () => void;
};

export default function MenuScreen({ hasSave, onContinue, onNew, onMaps, onSettings }: Props) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', padding: 24 }}>
      <View style={{ marginBottom: 36 }}>
        <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: theme.accent, marginBottom: 18 }} />
        <Text style={{ color: theme.text, fontFamily: FONT.bold, fontSize: 34 }}>Terrain Log</Text>
        <Text style={{ color: theme.textSub, fontFamily: FONT.regular, fontSize: 15, marginTop: 6 }}>
          Открывайте карту своими маршрутами
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        {hasSave && <Button kind="accent" label="Продолжить сессию" onPress={onContinue} />}
        <Button kind={hasSave ? 'card' : 'accent'} label="Новое исследование" onPress={onNew} />
        <Button label="Карты" onPress={onMaps} />
        <Button label="Настройки" onPress={onSettings} />
      </View>
    </View>
  );
}