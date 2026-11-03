import { File, FileMode } from 'expo-file-system';
import { regionUri } from './regionStore';

type Handle = ReturnType<File['open']>;

const handles: Record<string, Handle> = {};
let queue: Promise<unknown> = Promise.resolve();

const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < n ? bytes[i + 1] : 0;
    const b2 = i + 2 < n ? bytes[i + 2] : 0;
    out +=
      CH[b0 >> 2] +
      CH[((b0 & 3) << 4) | (b1 >> 4)] +
      (i + 1 < n ? CH[((b1 & 15) << 2) | (b2 >> 6)] : '=') +
      (i + 2 < n ? CH[b2 & 63] : '=');
  }
  return out;
}

// Читает кусок файла карты. Запросы идут по очереди.
// При ошибке возвращает строку, начинающуюся с "ERR:", чтобы её было видно в отладочной панели.
export function readSlice(id: string, offset: number, length: number): Promise<string> {
  const job = queue.then(async () => {
    try {
      let h = handles[id];
      if (!h) {
        h = new File(regionUri(id)).open(FileMode.ReadOnly);
        handles[id] = h;
      }
      h.offset = offset;
      const bytes = await h.readBytes(length);
      return toBase64(bytes);
    } catch (e) {
      return 'ERR:' + String((e as Error)?.message ?? e);
    }
  });
  queue = job;
  return job;
}

export function closeAllHandles() {
  for (const id of Object.keys(handles)) {
    try {
      handles[id].close();
    } catch {}
    delete handles[id];
  }
}