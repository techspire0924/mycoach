import { Temporal } from '@js-temporal/polyfill';
export const TIME_ZONE = 'America/Chicago' as const;
export function parseInstant(value: string | Date): Temporal.Instant {
  const iso = value instanceof Date ? value.toISOString() : value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  return Temporal.Instant.from(iso);
}
export function instantDateKey(value: string | Date = new Date()): string {
  return parseInstant(value).toZonedDateTimeISO(TIME_ZONE).toPlainDate().toString();
}
export function timestampDate(value: string): Date {
  return new Date(parseInstant(value).epochMilliseconds);
}
export function dateAdd(value: string, days: number): string {
  return Temporal.PlainDate.from(value).add({ days }).toString();
}
export function dateDay(value: string): number { return Temporal.PlainDate.from(value).dayOfWeek % 7; }
export function sundayStartInstant(today = instantDateKey()): string {
  return Temporal.PlainDate.from(dateAdd(today, -dateDay(today)))
    .toZonedDateTime({ timeZone: TIME_ZONE, plainTime: '00:00' }).toInstant().toString();
}
