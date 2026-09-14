import { describe, expect, it } from "vitest";
import type {
  Habit,
  HabitLog,
  Task,
  TaskCompletion,
  TaskStatus,
  TaskStatusEvent,
} from "../db/types";
import { addDays, toLocalDateKey } from "../utils/date";
import {
  computeHabitPerformance,
  computeOneTimePerformance,
  computeRecurringPerformance,
} from "./analytics";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test task",
    status: "todo",
    due_date: null,
    is_urgent: 0,
    parent_goal_id: null,
    parent_task_id: null,
    position: 0,
    task_type: "onetime",
    recurrence_type: null,
    recurrence_days: null,
    recurrence_end_date: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

function event(
  id: string,
  toStatus: TaskStatus,
  occurredAt: string,
  fromStatus: TaskStatus | null,
  baseline = false,
): TaskStatusEvent {
  return {
    id,
    task_id: "task-1",
    from_status: fromStatus,
    to_status: toStatus,
    occurred_at: occurredAt,
    is_baseline: baseline ? 1 : 0,
  };
}

function completion(date: string): TaskCompletion {
  return { task_id: "task-1", completed_date: date };
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "Test habit",
    frequency: "daily",
    created_at: "2026-07-01T12:00:00.000Z",
    finished_at: null,
    ...overrides,
  };
}

function habitLog(date: string): HabitLog {
  return {
    id: `log-${date}`,
    habit_id: "habit-1",
    logged_date: date,
    created_at: `${date}T12:00:00.000Z`,
  };
}

describe("local calendar dates", () => {
  it("formats local dates without UTC rollover", () => {
    expect(toLocalDateKey(new Date(2026, 6, 28, 23, 45))).toBe("2026-07-28");
  });

  it("adds calendar days across daylight-saving changes", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("one-time lifecycle performance", () => {
  it("uses the first start, cumulative active time, and latest completion after reopen", () => {
    const events = [
      event("1", "todo", "2026-07-01T12:00:00.000Z", null),
      event("2", "in_progress", "2026-07-02T12:00:00.000Z", "todo"),
      event("3", "done", "2026-07-03T12:00:00.000Z", "in_progress"),
      event("4", "todo", "2026-07-04T12:00:00.000Z", "done"),
      event("5", "in_progress", "2026-07-05T12:00:00.000Z", "todo"),
      event("6", "done", "2026-07-06T12:00:00.000Z", "in_progress"),
    ];
    const result = computeOneTimePerformance(
      task({ status: "done" }),
      events,
      new Date("2026-07-07T12:00:00.000Z"),
    );

    expect(result.startedAt).toBe("2026-07-02T12:00:00.000Z");
    expect(result.finishedAt).toBe("2026-07-06T12:00:00.000Z");
    expect(result.backlogMs).toBe(24 * 60 * 60 * 1000);
    expect(result.activeMs).toBe(2 * 24 * 60 * 60 * 1000);
    expect(result.totalMs).toBe(5 * 24 * 60 * 60 * 1000);
  });

  it("does not fabricate pre-upgrade start or backlog timing", () => {
    const result = computeOneTimePerformance(
      task({ status: "done" }),
      [
        event("baseline", "in_progress", "2026-07-10T12:00:00.000Z", null, true),
        event("done", "done", "2026-07-12T12:00:00.000Z", "in_progress"),
      ],
      new Date("2026-07-12T12:00:00.000Z"),
    );

    expect(result.hasPartialHistory).toBe(true);
    expect(result.startedAt).toBeNull();
    expect(result.backlogMs).toBeNull();
    expect(result.activePartial).toBe(true);
    expect(result.activeMs).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("uses a backfilled pre-baseline start for backlog and active timing", () => {
    const result = computeOneTimePerformance(
      task({ status: "in_progress" }),
      [
        event("backfill", "in_progress", "2026-07-05T12:00:00.000Z", "todo"),
        event("baseline", "in_progress", "2026-07-10T12:00:00.000Z", null, true),
      ],
      new Date("2026-07-12T12:00:00.000Z"),
    );

    expect(result.startedAt).toBe("2026-07-05T12:00:00.000Z");
    expect(result.backlogMs).toBe(4 * 24 * 60 * 60 * 1000);
    expect(result.activeMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(result.activePartial).toBe(false);
  });

  it("shows live backlog time for a task that has not started", () => {
    const result = computeOneTimePerformance(
      task({ status: "todo" }),
      [event("baseline", "todo", "2026-07-10T12:00:00.000Z", null, true)],
      new Date("2026-07-12T12:00:00.000Z"),
    );

    expect(result.startedAt).toBeNull();
    expect(result.backlogMs).toBe(11 * 24 * 60 * 60 * 1000);
    expect(result.activeMs).toBeNull();
    expect(result.finishedAt).toBeNull();
  });
});

describe("recurring task performance", () => {
  it("keeps today pending and excludes it from the completion denominator", () => {
    const recurring = task({
      task_type: "recurring",
      recurrence_type: "daily",
      created_at: "2026-07-01T12:00:00.000Z",
    });
    const result = computeRecurringPerformance(
      recurring,
      [completion("2026-07-01")],
      [],
      "all",
      "2026-07-03",
    );

    expect(result.completed).toBe(1);
    expect(result.missed).toBe(1);
    expect(result.pending).toBe(1);
    expect(result.expected).toBe(2);
    expect(result.rate).toBe(50);
  });

  it("evaluates workdays and custom weekdays against their real schedule", () => {
    const workdays = task({
      task_type: "recurring",
      recurrence_type: "workdays",
      created_at: "2026-07-03T12:00:00.000Z",
    });
    const workdayResult = computeRecurringPerformance(
      workdays,
      [completion("2026-07-03"), completion("2026-07-06")],
      [],
      "all",
      "2026-07-07",
    );
    expect(workdayResult.completed).toBe(2);
    expect(workdayResult.pending).toBe(1);
    expect(workdayResult.expected).toBe(2);

    const custom = task({
      task_type: "recurring",
      recurrence_type: "custom",
      recurrence_days: "[1,3,5]",
      created_at: "2026-07-01T12:00:00.000Z",
    });
    const customResult = computeRecurringPerformance(
      custom,
      [completion("2026-07-01"), completion("2026-07-02")],
      [],
      "all",
      "2026-07-03",
    );
    expect(customResult.completed).toBe(1);
    expect(customResult.extras).toBe(1);
    expect(customResult.pending).toBe(1);
  });
});

describe("habit performance", () => {
  it("tracks daily habit misses and pending today", () => {
    const result = computeHabitPerformance(
      habit(),
      [habitLog("2026-07-01"), habitLog("2026-07-03")],
      "all",
      "2026-07-04",
    );
    expect(result.completed).toBe(2);
    expect(result.missed).toBe(1);
    expect(result.pending).toBe(1);
    expect(result.rate).toBe(67);
  });

  it("counts a weekly habit once per calendar week", () => {
    const result = computeHabitPerformance(
      habit({ frequency: "weekly" }),
      [habitLog("2026-07-02"), habitLog("2026-07-07")],
      "all",
      "2026-07-08",
    );
    expect(result.completed).toBe(2);
    expect(result.expected).toBe(2);
    expect(result.pending).toBe(0);
    expect(result.currentStreak).toBe(2);
    expect(result.rate).toBe(100);
  });

  it("stops counting a finished daily habit after its finish date", () => {
    const result = computeHabitPerformance(
      habit({ finished_at: "2026-07-03T09:00:00.000Z" }),
      [habitLog("2026-07-01"), habitLog("2026-07-03")],
      "all",
      "2026-07-10",
    );
    expect(result.cells[result.cells.length - 1].date).toBe("2026-07-03");
    expect(result.completed).toBe(2);
    expect(result.missed).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.expected).toBe(3);
    expect(result.finishedAt).toBe("2026-07-03T09:00:00.000Z");
  });

  it("ignores the truncated final week of a finished weekly habit", () => {
    const result = computeHabitPerformance(
      habit({ frequency: "weekly", finished_at: "2026-07-08T09:00:00.000Z" }),
      [habitLog("2026-07-02")],
      "all",
      "2026-07-20",
    );
    // Week of Jun 29 completed; the Jul 6–8 stub is neither missed nor pending.
    expect(result.completed).toBe(1);
    expect(result.expected).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.rate).toBe(100);
  });
});
