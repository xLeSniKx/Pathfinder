import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { GpsFilter } from './gpsFilter';
import { distMeters, LatLon, Segments, segmentsLengthM } from './geo';
import { TrackWriter, loadTrack } from './trackStore';

export const TRACK_TASK = 'bike-track-task';
const MIN_STEP_M = 3;
const FLUSH_EVERY_MS = 15000;

export type Stats = { speedKmh: number; accuracy: number | null; jumps: number; hasFix: boolean };
type Event = { point?: LatLon; newSegment?: boolean };

let segments: Segments = [];
let distanceM = 0;
let lastStored: LatLon | null = null;
let writer: TrackWriter | null = null;
let filter = new GpsFilter();
let loading: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let lastFlush = 0;
let stats: Stats = { speedKmh: 0, accuracy: null, jumps: 0, hasFix: false };
const listeners = new Set<(e: Event) => void>();

export const subscribe = (fn: (e: Event) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const emit = (e: Event) => listeners.forEach((f) => f(e));

export const getSegments = () => segments;
export const getDistanceM = () => distanceM;
export const getStats = () => stats;

function ensureLoaded(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const loaded = await loadTrack();
      segments = loaded.segments;
      distanceM = segmentsLengthM(segments);
      writer = new TrackWriter(loaded.lastIndex);
      lastStored = null;
    })();
  }
  return loading;
}

function processOne(loc: Location.LocationObject) {
  const { latitude, longitude, accuracy: acc, speed } = loc.coords;
  stats = {
    ...stats,
    accuracy: acc ?? null,
    speedKmh: speed != null && speed > 0 ? Math.round(speed * 3.6) : 0,
  };
  const res = filter.check({
    lat: latitude,
    lon: longitude,
    t: loc.timestamp,
    acc: acc ?? null,
    speed: speed ?? null,
  });
  stats.jumps = filter.jumps;
  if (!res.ok || !writer) {
    emit({});
    return;
  }
  stats.hasFix = true;
  const p: LatLon = [latitude, longitude];

  if (res.newSegment || segments.length === 0 || !lastStored) {
    writer.startSegment();
    writer.add(p);
    segments.push([p]);
    lastStored = p;
    emit({ point: p, newSegment: true });
    return;
  }
  const step = distMeters(lastStored[0], lastStored[1], p[0], p[1]);
  if (step < MIN_STEP_M) {
    emit({});
    return;
  }
  writer.add(p);
  segments[segments.length - 1].push(p);
  lastStored = p;
  distanceM += step;
  emit({ point: p, newSegment: false });
}

export function handleLocations(locs: Location.LocationObject[]) {
  queue = queue
    .then(async () => {
      await ensureLoaded();
      for (const l of locs) processOne(l);
      if (Date.now() - lastFlush > FLUSH_EVERY_MS) {
        writer?.flush();
        lastFlush = Date.now();
      }
    })
    .catch((e) => console.warn('track error', e));
  return queue;
}

// Задача должна быть объявлена при запуске приложения (см. _layout.tsx)
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACK_TASK, async ({ data, error }) => {
  if (error || !data) return;
  await handleLocations(data.locations);
});

// Новая сессия: сбрасываем состояние и грузим трек с диска
export async function prepare() {
  segments = [];
  distanceM = 0;
  lastStored = null;
  writer = null;
  filter = new GpsFilter();
  loading = null;
  queue = Promise.resolve();
  stats = { speedKmh: 0, accuracy: null, jumps: 0, hasFix: false };
  await ensureLoaded();
}

export async function startTracking(): Promise<'ok' | 'denied'> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  await Location.requestBackgroundPermissionsAsync().catch(() => {});
  if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) {
    await Location.stopLocationUpdatesAsync(TRACK_TASK);
  }
  await Location.startLocationUpdatesAsync(TRACK_TASK, {
    accuracy: Location.Accuracy.Highest,
    timeInterval: 1000,
    distanceInterval: 1,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Terrain Log',
      notificationBody: 'Идёт запись маршрута',
      notificationColor: '#5EE6A8',
    },
  });
  return 'ok';
}

export async function stopTracking() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) {
      await Location.stopLocationUpdatesAsync(TRACK_TASK);
    }
  } catch {}
  await queue;
  writer?.flush();
}