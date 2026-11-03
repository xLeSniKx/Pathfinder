import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { FONT } from '../theme/fonts';

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: 'accent' | 'card';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, kind = 'card', style }: ButtonProps) {
  const { theme } = useTheme();
  const accent = kind === 'accent';
  const fg = accent ? theme.onAccent : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: accent ? theme.accent : theme.card,
          borderColor: accent ? 'transparent' : theme.cardBorder,
          borderWidth: 1,
          borderRadius: 20,
          minHeight: 56,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontFamily: FONT.semibold, fontSize: 16 }}>{label}</Text>
      <Text style={{ color: fg, fontFamily: FONT.medium, fontSize: 22, opacity: 0.6 }}>›</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          borderWidth: 1,
          borderRadius: 24,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.bg,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: theme.cardBorder,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: on ? theme.accentSoft : 'transparent',
            }}
          >
            <Text style={{ color: on ? theme.accent : theme.textSub, fontFamily: FONT.semibold, fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BackPill({ onPress, label = '← Меню' }: { onPress: () => void; label?: string }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.card,
        borderColor: theme.cardBorder,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: FONT.semibold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}