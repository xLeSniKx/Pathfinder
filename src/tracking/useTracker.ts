import { useEffect, useRef, useState } from 'react';
import type { LatLon } from './geo';
import {
  prepare, startTracking, stopTracking, subscribe,
  getSegments, getDistanceM, getStats,
} from './trackEngine';

export function useTracker(
  active: boolean,
  onPoint: (p: LatLon, newSegment: boolean) => void
) {
  const onPointRef = useRef(onPoint);
  onPointRef.current = onPoint;

  const [ready, setReady] = useState(false);
  const [hasFix, setHasFix] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [jumps, setJumps] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!active) return;
    setReady(false);
    setHasFix(false);
    setJumps(0);
    setSpeedKmh(0);
    setAccuracy(null);
    setPermissionDenied(false);

    let cancelled = false;
    const unsub = subscribe((e) => {
      const s = getStats();
      setAccuracy(s.accuracy);
      setSpeedKmh(s.speedKmh);
      setJumps(s.jumps);
      setHasFix(s.hasFix);
      setDistanceKm(getDistanceM() / 1000);
      if (e.point) onPointRef.current(e.point, !!e.newSegment);
    });

    (async () => {
      await prepare();
      if (cancelled) return;
      setDistanceKm(getDistanceM() / 1000);
      setReady(true);
      try {
        const res = await startTracking();
        if (cancelled) {
          await stopTracking();
          return;
        }
        if (res === 'denied') setPermissionDenied(true);
      } catch (e) {
        console.warn('startTracking failed', e);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
      stopTracking();
    };
  }, [active]);

  return {
    ready, hasFix, distanceKm, speedKmh, accuracy, jumps, permissionDenied,
    getSegments: () => getSegments(),
  };
}