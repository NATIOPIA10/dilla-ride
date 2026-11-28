import type { Driver, LatLng } from '../contract/types';

export function formatAddisTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatAddisShortTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatElapsedSince(iso: string, nowMs: number): string {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '00:00';
  const diffSec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBirr(santim: number | null | undefined): string {
  if (typeof santim !== 'number' || Number.isNaN(santim)) return '0 birr';
  const birr = santim / 100;
  return Number.isInteger(birr) ? `${birr} birr` : `${birr.toFixed(2)} birr`;
}

export type DriverChipStatus = 'Ready' | 'On ride' | 'Payment pending' | 'No signal' | 'Offline';

export function getDriverStatusLabel(driver: Pick<Driver, 'availability' | 'wants_online' | 'connected'>): DriverChipStatus {
  if (driver.wants_online && !driver.connected) {
    return 'No signal';
  }
  if (driver.availability === 'READY') return 'Ready';
  if (driver.availability === 'ON_RIDE') return 'On ride';
  if (driver.availability === 'PAYMENT_PENDING') return 'Payment pending';
  return 'Offline';
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone.trim());
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2 * sin2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function getAddisIsoWeekId(date = new Date()): string {
  // Shift to Africa/Addis_Ababa (UTC+3) for Monday-to-Sunday ISO week boundary
  const addisMs = date.getTime() + 3 * 3600 * 1000;
  const d = new Date(addisMs);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): void {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
