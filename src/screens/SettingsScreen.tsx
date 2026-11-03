import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ACCENTS, ThemeMode } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { FONT } from '../theme/fonts';
import { BackPill, Button, Card, Segmented } from '../ui/kit';

type Props = {
  fogRadius: 'normal' | 'wide';
  onRadius: (k: 'normal' | 'wide') => void;
  onBack: () => void;
};

export default function SettingsScreen({ fogRadius, onRadius, onBack }: Props) {
  const { theme, mode, accentId, setMode, setAccentId } = useTheme();
  const [showRick, setShowRick] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useVideoPlayer(require('../../assets/rick.mp4'), (p) => {
    p.loop = true;
  });

  const closeRick = () => {
    player.pause();
    player.currentTime = 0;
    setShowRick(false);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!showRick) return;
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRick();
      return true;
    });
    return () => h.remove();
  }, [showRick]);

  const label = {
    color: theme.textSub,
    fontFamily: FONT.semibold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 10,
  } as const;

  const swatches = (group: 'green' | 'other') => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {ACCENTS.filter((a) => a.group === group).map((a) => {
        const color = theme.scheme === 'dark' ? a.dark : a.light;
        const on = a.id === accentId;
        return (
          <Pressable
            key={a.id}
            onPress={() => setAccentId(a.id)}
            style={{ alignItems: 'center', width: 74, marginBottom: 12 }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                borderWidth: on ? 3 : 0,
                borderColor: theme.text,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: on ? 36 : 46,
                  height: on ? 36 : 46,
                  borderRadius: 23,
                  backgroundColor: color,
                }}
              />
            </View>
            <Text
              style={{
                color: on ? theme.text : theme.textSub,
                fontFamily: FONT.medium,
                fontSize: 12,
                marginTop: 5,
              }}
            >
              {a.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40, gap: 14 }}>
        <BackPill onPress={onBack} />
        <Text style={{ color: theme.text, fontFamily: FONT.bold, fontSize: 28, marginVertical: 6 }}>Настройки</Text>

        <Card>
          <Text style={label}>ТЕМА</Text>
          <Segmented<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'system', label: 'Как в телефоне' },
              { value: 'dark', label: 'Тёмная' },
              { value: 'light', label: 'Светлая' },
            ]}
          />
        </Card>

        <Card>
          <Text style={label}>АКЦЕНТНЫЙ ЦВЕТ</Text>
          <Text style={{ color: theme.textMuted, fontFamily: FONT.regular, fontSize: 12, marginBottom: 8 }}>
            Зелёные оттенки
          </Text>
          {swatches('green')}
          <Text style={{ color: theme.textMuted, fontFamily: FONT.regular, fontSize: 12, marginVertical: 8 }}>
            Другие
          </Text>
          {swatches('other')}
        </Card>

        <Card>
          <Text style={label}>РАДИУС ТУМАНА</Text>
          <Segmented<'normal' | 'wide'>
            value={fogRadius}
            onChange={onRadius}
            options={[
              { value: 'normal', label: 'Стандарт, 45 м' },
              { value: 'wide', label: 'Широкий, 80 м' },
            ]}
          />
        </Card>

        <Button
          label="✨ Получить премиум"
          onPress={() => {
            setIsPlaying(false);
            setShowRick(true);
          }}
        />
      </ScrollView>

      {showRick && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            zIndex: 2000,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: theme.card,
              borderColor: theme.accent,
              borderWidth: 1,
              borderRadius: 24,
              padding: 16,
              gap: 12,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: FONT.bold, fontSize: 16, textAlign: 'center' }}>
              СТАТУС: ЛЕГЕНДА
            </Text>
            <View
              style={{
                height: 190,
                backgroundColor: '#000',
                borderRadius: 16,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isPlaying && (
                <VideoView
                  player={player}
                  style={{ width: '100%', height: '100%' }}
                  nativeControls={false}
                  allowsPictureInPicture={false}
                  contentFit="cover"
                />
              )}
              {!isPlaying && (
                <Pressable
                  onPress={() => {
                    setIsPlaying(true);
                    player.play();
                  }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}
                >
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      backgroundColor: theme.accent,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.onAccent, fontSize: 24, marginLeft: 4 }}>▶</Text>
                  </View>
                </Pressable>
              )}
            </View>
            <Text style={{ color: theme.accent, fontFamily: FONT.medium, fontSize: 13, textAlign: 'center' }}>
              Ознакомьтесь с привилегиями ✨
            </Text>
            <Button kind="accent" label="Закрыть" onPress={closeRick} />
          </View>
        </View>
      )}
    </View>
  );
}