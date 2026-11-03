import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { distMeters, LatLon, Segments } from './geo';

const OLD_KEY = '@fog_of_war_track_history';
const MIGRATED_KEY = '@track_migrated_v2';
const MAX_CHUNK_POINTS = 4000;
const OLD_SPLIT_M = 500;

function trackDir(): Directory {
  const d = new Directory(Paths.document, 'track');
  if (!d.exists) d.create();
  return d;
}

function chunkFile(n: number): File {
  return new File(trackDir(), 'seg-' + String(n).padStart(6, '0') + '.json');
}

function writeText(f: File, text: string) {
  try {
    if (!f.exists) f.create();
    const r: unknown = f.write(text);
    if (r instanceof Promise) r.catch((e) => console.warn('track write failed', e));
  } catch (e) {
    console.warn('track write failed', e);
  }
}

// Пишет трек файлами-кусочками: старые кусочки больше не перезаписываются
export class TrackWriter {
  private index: number;
  private current: LatLon[] = [];
  private dirty = false;

  constructor(startIndex: number) {
    this.index = startIndex;
  }

  startSegment() {
    this.flush();
    this.index++;
    this.current = [];
  }

  add(p: LatLon) {
    this.current.push(p);
    this.dirty = true;
    if (this.current.length >= MAX_CHUNK_POINTS) {
      this.flush();
      this.index++;
      this.current = [p]; // новый кусочек продолжает линию
      this.dirty = true;
    }
  }

  flush() {
    if (!this.dirty || this.current.length === 0) return;
    writeText(chunkFile(this.index), JSON.stringify(this.current));
    this.dirty = false;
  }
}

function splitByGaps(points: LatLon[], maxGapM: number): Segments {
  const segs: Segments = [];
  let cur: LatLon[] = [];
  for (const p of points) {
    const last = cur[cur.length - 1];
    if (last && distMeters(last[0], last[1], p[0], p[1]) > maxGapM) {
      segs.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

// Один раз переносим старый трек из AsyncStorage в файлы
async function migrateOldTrack() {
  try {
    if (await AsyncStorage.getItem(MIGRATED_KEY)) return;
    const raw = await AsyncStorage.getItem(OLD_KEY);
    if (raw) {
      const points = JSON.parse(raw) as LatLon[];
      const w = new TrackWriter(0);
      for (const seg of splitByGaps(points, OLD_SPLIT_M)) {
        w.startSegment();
        for (const p of seg) w.add(p);
      }
      w.flush();
    }
    await AsyncStorage.setItem(MIGRATED_KEY, '1');
  } catch (e) {
    console.warn('track migration failed', e);
  }
}

function listChunks(): File[] {
  const items = trackDir().list();
  const files: File[] = [];
  for (const it of items) {
    if (it instanceof File && it.name.startsWith('seg-')) files.push(it);
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function hasSavedTrack(): Promise<boolean> {
  await migrateOldTrack();
  try {
    return listChunks().length > 0;
  } catch {
    return false;
  }
}

export async function loadTrack(): Promise<{ segments: Segments; lastIndex: number }> {
  await migrateOldTrack();
  const segments: Segments = [];
  let lastIndex = 0;
  try {
    for (const f of listChunks()) {
      try {
        const pts = JSON.parse(f.textSync()) as LatLon[];
        if (pts.length) segments.push(pts);
      } catch (e) {
        console.warn('bad track chunk', f.name, e);
      }
      lastIndex = Math.max(lastIndex, parseInt(f.name.slice(4, 10), 10) || 0);
    }
  } catch (e) {
    console.warn('track load failed', e);
  }
  return { segments, lastIndex };
}

export async function clearTrack() {
  try {
    const d = new Directory(Paths.document, 'track');
    if (d.exists) d.delete();
  } catch (e) {
    console.warn('track clear failed', e);
  }
  try {
    await AsyncStorage.removeItem(OLD_KEY);
    await AsyncStorage.setItem(MIGRATED_KEY, '1');
  } catch {}
}