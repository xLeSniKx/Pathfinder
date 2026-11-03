import { distMeters } from './geo';

export type Fix = {
  lat: number;
  lon: number;
  t: number; // время точки, мс
  acc: number | null; // точность, м
  speed: number | null; // скорость, м/с
};

export type RejectReason = 'stale' | 'accuracy' | 'speed' | 'jump' | 'warmup';
export type FilterResult =
  | { ok: true; newSegment: boolean }
  | { ok: false; reason: RejectReason };

// Пороги можно подкрутить по реальным поездкам
export const FILTER = {
  maxAccuracyM: 30, // точность хуже - точку не берём
  maxSpeedMs: 20, // быстрее ~72 км/ч для велосипеда нереально
  maxDeviceSpeedMs: 25,
  maxAgeMs: 15000, // старые "кэшированные" точки отбрасываем
  gapNewSegmentS: 60, // пропуск дольше этого - новая линия трека
  warmupFixes: 3, // сколько согласованных точек нужно при старте
};

export class GpsFilter {
  private last: Fix | null = null;
  private warm: Fix[] = [];
  jumps = 0; // сколько точек отброшено как скачок или нереальная скорость

  check(fix: Fix): FilterResult {
    if (Date.now() - fix.t > FILTER.maxAgeMs) return this.no('stale');
    if (fix.acc == null || fix.acc > FILTER.maxAccuracyM) return this.no('accuracy');
    if (fix.speed != null && fix.speed > FILTER.maxDeviceSpeedMs) return this.no('speed');

    if (!this.last) return this.warmup(fix);

    const dt = (fix.t - this.last.t) / 1000;
    if (dt <= 0) return this.no('stale');
    if (!this.plausible(this.last, fix, dt)) return this.no('jump');

    this.last = fix;
    return { ok: true, newSegment: dt > FILTER.gapNewSegmentS };
  }

  // Старт: ждём несколько точек, согласованных друг с другом
  private warmup(fix: Fix): FilterResult {
    const prev = this.warm[this.warm.length - 1];
    if (prev) {
      const dt = (fix.t - prev.t) / 1000;
      if (dt <= 0 || !this.plausible(prev, fix, dt)) this.warm = [];
    }
    this.warm.push(fix);
    if (this.warm.length >= FILTER.warmupFixes) {
      this.warm = [];
      this.last = fix;
      return { ok: true, newSegment: true };
    }
    return this.no('warmup');
  }

  // Можно ли за прошедшее время доехать из точки a в точку b
  private plausible(a: Fix, b: Fix, dt: number): boolean {
    const allowed = FILTER.maxSpeedMs * dt + (a.acc ?? 0) + (b.acc ?? 0);
    return distMeters(a.lat, a.lon, b.lat, b.lon) <= allowed;
  }

  private no(reason: RejectReason): FilterResult {
    if (reason === 'jump' || reason === 'speed') this.jumps++;
    return { ok: false, reason };
  }
}