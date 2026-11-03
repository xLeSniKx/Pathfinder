export type LatLon = [number, number];
export type Segments = LatLon[][];

export function distMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function segmentsLengthM(segments: Segments): number {
  let total = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      total += distMeters(seg[i - 1][0], seg[i - 1][1], seg[i][0], seg[i][1]);
    }
  }
  return total;
}