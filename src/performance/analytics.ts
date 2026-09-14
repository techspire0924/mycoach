import type {
  Habit,
  HabitLog,
  Task,
  TaskCompletion,
  TaskStatus,
  TaskStatusEvent,
} from "../db/types";
import {
  addDays,
  instantDateKey,
  timestampDate,
  eachDate,
  earliestDate,
  endOfWeek,
  latestDate,
  parseDateKey,
  startOfWeek,
  toLocalDateKey,
} from "../utils/date";

export type PerformanceRange = "7d" | "30d" | "90d" | "1y" | "all";
export type HeatmapStatus = "completed" | "missed" | "pending" | "not_scheduled" | "extra";

export interface HeatmapDay {
  date: string;
  status: HeatmapStatus;
}

export interface OneTimePerformance {
  task: Task;
  events: TaskStatusEvent[];
  hasPartialHistory: boolean;
  trackingStartedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  backlogMs: number | null;
  activeMs: number | null;
  activePartial: boolean;
  totalMs: number | null;
}

export interface ScheduledPerformance {
  id: string;
  title: string;
  createdAt: string;
  scheduleLabel: string;
  cells: HeatmapDay[];
  completed: number;
  expected: number;
  missed: number;
  pending: number;
  extras: number;
  rate: number | null;
  currentStreak: number;
  longestStreak: number;
  hasPartialHistory: boolean;
  finishedAt: string | null;
}

const RANGE_DAYS: Record<Exclude<PerformanceRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export function rangeStart(range: PerformanceRange, today = toLocalDateKey()): string | null {
  return range === "all" ? null : addDays(today, -(RANGE_DAYS[range] - 1));
}

function toMs(value: string): number {
  return timestampDate(value).getTime();
}

function sortedEvents(events: TaskStatusEvent[]): TaskStatusEvent[] {
  return [...events].sort((a, b) => {
    const time = a.occurred_at.localeCompare(b.occurred_at);
    return time || a.id.localeCompare(b.id);
  });
}

export function computeOneTimePerformance(
  task: Task,
  allEvents: TaskStatusEvent[],
  now = new Date(),
): OneTimePerformance {
  const events = sortedEvents(allEvents.filter((event) => event.task_id === task.id));
  const baseline = events.find((event) => event.is_baseline === 1) ?? null;
  const exactEvents = events.filter((event) => event.is_baseline !== 1);
  const startEvent = exactEvents.find((event) => event.to_status === "in_progress") ?? null;
  const finishEvent = [...exactEvents].reverse().find((event) => event.to_status === "done") ?? null;
  const hasPartialHistory = Boolean(baseline);

  let activeMs = 0;
  let observedActive = false;
  let activePartial = false;
  events.forEach((event, index) => {
    if (event.to_status !== "in_progress") return;
    observedActive = true;
    if (event.is_baseline === 1 && !events
      .slice(0, index)
      .some((previous) => previous.to_status === "in_progress")) {
      activePartial = true;
    }
    const next = events[index + 1];
    const end = next ? toMs(next.occurred_at) : now.getTime();
    activeMs += Math.max(0, end - toMs(event.occurred_at));
  });

  const startedAt = startEvent?.occurred_at ?? null;
  const finishedAt = finishEvent?.occurred_at ?? null;

  return {
    task,
    events,
    hasPartialHistory,
    trackingStartedAt: baseline?.occurred_at ?? null,
    startedAt,
    finishedAt,
    backlogMs: startedAt
      ? Math.max(0, toMs(startedAt) - toMs(task.created_at))
      : task.status === "todo"
        ? Math.max(0, now.getTime() - toMs(task.created_at))
        : null,
    activeMs: observedActive ? activeMs : null,
    activePartial,
    totalMs: finishedAt ? Math.max(0, toMs(finishedAt) - toMs(task.created_at)) : null,
  };
}

function taskScheduleLabel(task: Task): string {
  if (task.recurrence_type === "daily") return "Daily";
  if (task.recurrence_type === "workdays") return "Workdays";
  if (task.recurrence_type === "custom") {
    const names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const days = task.recurrence_days ? JSON.parse(task.recurrence_days) as number[] : [];
    return days.map((day) => names[day]).join(" · ") || "Custom";
  }
  return "Recurring";
}

function taskOccurs(task: Task, date: string): boolean {
  const day = parseDateKey(date).getDay();
  if (task.recurrence_type === "daily") return true;
  if (task.recurrence_type === "workdays") return day >= 1 && day <= 5;
  if (task.recurrence_type === "custom" && task.recurrence_days) {
    try {
      return (JSON.parse(task.recurrence_days) as number[]).includes(day);
    } catch {
      return false;
    }
  }
  return false;
}

function calculateStreaks(statuses: HeatmapStatus[]): { current: number; longest: number } {
  let running = 0;
  let longest = 0;
  for (const status of statuses) {
    if (status === "completed") {
      running += 1;
      longest = Math.max(longest, running);
    } else if (status === "missed") {
      running = 0;
    }
  }

  let current = 0;
  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    if (statuses[index] === "pending") continue;
    if (statuses[index] !== "completed") break;
    current += 1;
  }
  return { current, longest };
}

function summarizeCells(
  cells: HeatmapDay[],
  streakStatuses: HeatmapStatus[],
): Pick<ScheduledPerformance,
  "completed" | "expected" | "missed" | "pending" | "extras" |
  "rate" | "currentStreak" | "longestStreak"
> {
  const completed = streakStatuses.filter((status) => status === "completed").length;
  const missed = streakStatuses.filter((status) => status === "missed").length;
  const pending = streakStatuses.filter((status) => status === "pending").length;
  const expected = completed + missed;
  const extras = cells.filter((cell) => cell.status === "extra").length;
  const streaks = calculateStreaks(streakStatuses);
  return {
    completed,
    expected,
    missed,
    pending,
    extras,
    rate: expected > 0 ? Math.round((completed / expected) * 100) : null,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
  };
}

function exactFinishDate(task: Task, events: TaskStatusEvent[]): string | null {
  if (task.status !== "done") return null;
  const doneEvents = sortedEvents(events)
    .filter((event) => event.is_baseline !== 1 && event.to_status === "done");
  const done = doneEvents[doneEvents.length - 1];
  return done ? instantDateKey(done.occurred_at) : null;
}

export function computeRecurringPerformance(
  task: Task,
  completions: TaskCompletion[],
  events: TaskStatusEvent[],
  range: PerformanceRange,
  today = toLocalDateKey(),
): ScheduledPerformance {
  const taskCompletions = completions
    .filter((completion) => completion.task_id === task.id)
    .map((completion) => completion.completed_date);
  const completionSet = new Set(taskCompletions);
  const created = instantDateKey(task.created_at);
  const start = latestDate(created, rangeStart(range, today)) ?? created;
  const exactFinish = exactFinishDate(task, events.filter((event) => event.task_id === task.id));
  let end = [today, task.recurrence_end_date, exactFinish]
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? today;
  const hasPartialHistory = events.some(
    (event) => event.task_id === task.id && event.is_baseline === 1,
  );

  if (task.status === "done" && !exactFinish) {
    end = latestDate(
      task.recurrence_end_date && task.recurrence_end_date <= today
        ? task.recurrence_end_date
        : null,
      ...taskCompletions.filter((date) => date <= today),
      created,
    ) ?? created;
  }

  const visualEnd = end < start ? start : end;
  const cells: HeatmapDay[] = [];
  const expectedStatuses: HeatmapStatus[] = [];

  for (const date of eachDate(start, visualEnd)) {
    const scheduled = date >= created && date <= end && taskOccurs(task, date);
    const completed = completionSet.has(date);
    let status: HeatmapStatus = "not_scheduled";
    if (scheduled && completed) status = "completed";
    else if (scheduled && date === today) status = "pending";
    else if (scheduled) status = "missed";
    else if (completed) status = "extra";
    cells.push({ date, status });
    if (scheduled) expectedStatuses.push(status);
  }

  return {
    id: task.id,
    title: task.title,
    createdAt: task.created_at,
    scheduleLabel: taskScheduleLabel(task),
    cells,
    ...summarizeCells(cells, expectedStatuses),
    hasPartialHistory,
    finishedAt: null,
  };
}

// A finished habit stops being scheduled after its finish date, so history
// stays visible without the trailing days counting as misses.
function habitEndDate(habit: Habit, today: string): string {
  const finished = habit.finished_at ? instantDateKey(habit.finished_at) : null;
  return earliestDate(finished, today) ?? today;
}

function computeDailyHabit(
  habit: Habit,
  logs: HabitLog[],
  range: PerformanceRange,
  today: string,
): ScheduledPerformance {
  const created = instantDateKey(habit.created_at);
  const start = latestDate(created, rangeStart(range, today)) ?? created;
  const end = habitEndDate(habit, today);
  const logSet = new Set(logs.map((log) => log.logged_date));
  const cells = eachDate(start, end).map<HeatmapDay>((date) => ({
    date,
    status: logSet.has(date) ? "completed" : date === today ? "pending" : "missed",
  }));
  const statuses = cells.map((cell) => cell.status);
  return {
    id: habit.id,
    title: habit.name,
    createdAt: habit.created_at,
    scheduleLabel: "Daily habit",
    cells,
    ...summarizeCells(cells, statuses),
    hasPartialHistory: false,
    finishedAt: habit.finished_at,
  };
}

function computeWeeklyHabit(
  habit: Habit,
  logs: HabitLog[],
  range: PerformanceRange,
  today: string,
): ScheduledPerformance {
  const created = instantDateKey(habit.created_at);
  const start = latestDate(created, rangeStart(range, today)) ?? created;
  const end = habitEndDate(habit, today);
  const cells = eachDate(start, end).map<HeatmapDay>((date) => ({
    date,
    status: "not_scheduled",
  }));
  const cellMap = new Map(cells.map((cell) => [cell.date, cell]));
  const statuses: HeatmapStatus[] = [];
  const firstWeek = startOfWeek(start);
  const lastWeek = startOfWeek(end);
  const finishedEarly = end < today;

  for (let week = firstWeek; week <= lastWeek; week = addDays(week, 7)) {
    const weekStart = week < created ? created : week;
    const weekEnd = endOfWeek(week) > end ? end : endOfWeek(week);
    if (weekEnd < start) continue;
    const weekLogs = logs
      .map((log) => log.logged_date)
      .filter((date) => date >= weekStart && date <= weekEnd && date >= start)
      .sort();

    if (weekLogs.length) {
      statuses.push("completed");
      weekLogs.forEach((date) => {
        const cell = cellMap.get(date);
        if (cell) cell.status = "completed";
      });
    } else if (week === lastWeek && !finishedEarly) {
      statuses.push("pending");
      const cell = cellMap.get(end);
      if (cell) cell.status = "pending";
    } else if (week === lastWeek && weekEnd < endOfWeek(week)) {
      // Habit finished mid-week: the truncated week is not a missed week.
      continue;
    } else {
      statuses.push("missed");
      const marker = weekEnd < start ? start : weekEnd;
      const cell = cellMap.get(marker);
      if (cell) cell.status = "missed";
    }
  }

  return {
    id: habit.id,
    title: habit.name,
    createdAt: habit.created_at,
    scheduleLabel: "Weekly habit",
    cells,
    ...summarizeCells(cells, statuses),
    hasPartialHistory: false,
    finishedAt: habit.finished_at,
  };
}

export function computeHabitPerformance(
  habit: Habit,
  allLogs: HabitLog[],
  range: PerformanceRange,
  today = toLocalDateKey(),
): ScheduledPerformance {
  const logs = allLogs.filter((log) => log.habit_id === habit.id);
  return habit.frequency === "weekly"
    ? computeWeeklyHabit(habit, logs, range, today)
    : computeDailyHabit(habit, logs, range, today);
}

export function average(values: Array<number | null>): { value: number | null; count: number } {
  const exact = values.filter((value): value is number => value !== null);
  return {
    value: exact.length ? exact.reduce((sum, value) => sum + value, 0) / exact.length : null,
    count: exact.length,
  };
}

export function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unknown";
  const minutes = Math.max(0, Math.round(value / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function statusLabel(status: TaskStatus | null): string {
  if (!status) return "Created";
  if (status === "in_progress") return "In progress";
  return status === "done" ? "Done" : "Backlog";
}
