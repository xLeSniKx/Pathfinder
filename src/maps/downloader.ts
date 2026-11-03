import * as FS from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATALOG_URLS } from './config';
import type { Region } from './types';
import { ensureDir, partUri, regionUri } from './regionStore';

const CATALOG_CACHE = '@maps_catalog_v1';
const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

async function fetchJson(url: string, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Список регионов: из сети, а если сети нет - из последнего сохранённого
export async function loadCatalog(): Promise<{ regions: Region[]; fromCache: boolean }> {
  for (const url of CATALOG_URLS) {
    try {
      const data = await fetchJson(url);
      if (Array.isArray(data?.regions)) {
        AsyncStorage.setItem(CATALOG_CACHE, JSON.stringify(data)).catch(() => {});
        return { regions: data.regions as Region[], fromCache: false };
      }
    } catch {}
  }
  const cached = await AsyncStorage.getItem(CATALOG_CACHE);
  if (cached) return { regions: JSON.parse(cached).regions as Region[], fromCache: true };
  throw new Error('catalog unavailable');
}

export class RegionDownload {
  private resumable: FS.DownloadResumable | null = null;
  private cancelled = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private region: Region,
    private onProgress: (frac: number) => void
  ) {}

  async cancel() {
    this.cancelled = true;
    try {
      await this.resumable?.pauseAsync(); // недокачанная часть остаётся на телефоне
    } catch {}
  }

  async run(): Promise<'done' | 'cancelled'> {
    await ensureDir();
    let lastError: unknown = new Error('no urls');
    for (const url of this.region.urls) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.cancelled) return 'cancelled';
        try {
          return await this.attempt(url);
        } catch (e) {
          lastError = e;
          await sleep(1500 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  private total() {
    return this.region.sizeBytes ?? this.region.sizeMB * 1024 * 1024;
  }

  private async attempt(url: string): Promise<'done' | 'cancelled'> {
    const part = partUri(this.region.id);
    const info = await FS.getInfoAsync(part);
    const have = info.exists ? info.size : 0;
    const total = this.total();

    // Если часть файла уже есть, пробуем докачать с того же места
    this.resumable = FS.createDownloadResumable(
      url,
      part,
      {},
      undefined,
      have > 0 ? String(have) : undefined
    );

    this.timer = setInterval(async () => {
      try {
        const i = await FS.getInfoAsync(part);
        if (i.exists) this.onProgress(Math.min(1, i.size / total));
      } catch {}
    }, 800);

    try {
      const res = await this.resumable.downloadAsync();
      if (this.cancelled) return 'cancelled';
      if (!res || (res.status !== 200 && res.status !== 206)) {
        throw new Error('HTTP ' + res?.status);
      }
    } finally {
      if (this.timer) clearInterval(this.timer);
    }

    const done = await FS.getInfoAsync(part);
    if (!done.exists) throw new Error('no file');
    if (this.region.sizeBytes && done.size !== this.region.sizeBytes) {
      await FS.deleteAsync(part, { idempotent: true }); // битый файл - начнём заново
      throw new Error('size mismatch');
    }
    await FS.deleteAsync(regionUri(this.region.id), { idempotent: true });
    await FS.moveAsync({ from: part, to: regionUri(this.region.id) });
    this.onProgress(1);
    return 'done';
  }
}