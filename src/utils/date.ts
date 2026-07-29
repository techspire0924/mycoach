const DAY_MS = 24 * 60 * 60 * 1000;

export function toLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(value: string, amount: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
}

export function daysBetween(start: string, end: string): number {
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function eachDate(start: string, end: string): string[] {
  if (start > end) return [];
  const dates: string[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

export function startOfWeek(value: string): string {
  const date = parseDateKey(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toLocalDateKey(date);
}

export function endOfWeek(value: string): string {
  return addDays(startOfWeek(value), 6);
}

export function formatDateKey(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return parseDateKey(value).toLocaleDateString("en-US", options);
}

export function earliestDate(...values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  return present.length ? present.sort()[0] : null;
}

export function latestDate(...values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  present.sort();
  return present.length ? present[present.length - 1] : null;
}
