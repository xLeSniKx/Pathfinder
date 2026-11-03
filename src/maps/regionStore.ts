import * as FS from 'expo-file-system/legacy';

const DIR = FS.documentDirectory + 'maps/';

export const regionUri = (id: string) => DIR + id + '.pmtiles';
export const partUri = (id: string) => DIR + id + '.pmtiles.part';

export async function ensureDir() {
  const info = await FS.getInfoAsync(DIR);
  if (!info.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true });
}

// Размер скачанной карты в байтах или null, если не скачана
export async function installedSize(id: string): Promise<number | null> {
  try {
    const info = await FS.getInfoAsync(regionUri(id));
    return info.exists ? info.size : null;
  } catch {
    return null;
  }
}

export async function removeRegion(id: string) {
  await FS.deleteAsync(regionUri(id), { idempotent: true });
  await FS.deleteAsync(partUri(id), { idempotent: true });
}
// Какие карты скачаны (id регионов)
export async function listInstalledIds(): Promise<string[]> {
  try {
    await ensureDir();
    const names = await FS.readDirectoryAsync(DIR);
    return names
      .filter((n) => n.endsWith('.pmtiles'))
      .map((n) => n.slice(0, -'.pmtiles'.length));
  } catch {
    return [];
  }
}