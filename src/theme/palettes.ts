export type Scheme = 'dark' | 'light';
export type ThemeMode = 'system' | Scheme;

export type Accent = {
  id: string;
  name: string;
  group: 'green' | 'other';
  dark: string; // цвет для тёмной темы
  light: string; // цвет для светлой темы (темнее, чтобы читался на белом)
};

export const ACCENTS: Accent[] = [
  { id: 'hvoya', name: 'Хвоя', group: 'green', dark: '#5EE6A8', light: '#0F9D6B' },
  { id: 'moss', name: 'Мох', group: 'green', dark: '#A9C46E', light: '#5B7F1E' },
  { id: 'sage', name: 'Шалфей', group: 'green', dark: '#9CC4AB', light: '#4B7A5B' },
  { id: 'jade', name: 'Нефрит', group: 'green', dark: '#4DD0B1', light: '#0E8C78' },
  { id: 'radar', name: 'Радар', group: 'other', dark: '#4CC9F0', light: '#0B7FA8' },
  { id: 'brass', name: 'Латунь', group: 'other', dark: '#D8B05A', light: '#9A7418' },
  { id: 'ice', name: 'Лёд', group: 'other', dark: '#C7DCEB', light: '#4A6B85' },
  { id: 'coral', name: 'Коралл', group: 'other', dark: '#F2735E', light: '#C9452F' },
];

export const DEFAULT_ACCENT = 'hvoya';

export type BaseColors = {
  bg: string;
  card: string;
  cardBorder: string;
  glass: string;
  glassBorder: string;
  text: string;
  textSub: string;
  textMuted: string;
  divider: string;
  danger: string;
  fog: string;
  fogOpacity: number;
};

export const BASE: Record<Scheme, BaseColors> = {
  dark: {
    bg: '#101214',
    card: '#1A1D20',
    cardBorder: 'rgba(255,255,255,0.08)',
    glass: 'rgba(255,255,255,0.09)',
    glassBorder: 'rgba(255,255,255,0.18)',
    text: '#F2F4F5',
    textSub: '#A3AAB0',
    textMuted: '#6B737A',
    divider: 'rgba(255,255,255,0.10)',
    danger: '#F2635B',
    fog: '#0F1113',
    fogOpacity: 0.9,
  },
  light: {
    bg: '#EEF1F3',
    card: '#FFFFFF',
    cardBorder: 'rgba(0,0,0,0.06)',
    glass: 'rgba(255,255,255,0.62)',
    glassBorder: 'rgba(0,0,0,0.10)',
    text: '#1B1F23',
    textSub: '#5F6870',
    textMuted: '#8C949B',
    divider: 'rgba(0,0,0,0.08)',
    danger: '#C9453B',
    fog: '#CFD6DC',
    fogOpacity: 0.9,
  },
};

export type Theme = BaseColors & {
  scheme: Scheme;
  accent: string;
  accentSoft: string; // полупрозрачная заливка акцентом
  onAccent: string; // цвет текста на акцентной кнопке
};

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

export function buildTheme(scheme: Scheme, accentId: string): Theme {
  const a = ACCENTS.find((x) => x.id === accentId) ?? ACCENTS[0];
  const accent = scheme === 'dark' ? a.dark : a.light;
  return {
    ...BASE[scheme],
    scheme,
    accent,
    accentSoft: withAlpha(accent, 0.18),
    onAccent: scheme === 'dark' ? '#0B0E10' : '#FFFFFF',
  };
}