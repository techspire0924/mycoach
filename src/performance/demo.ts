import type { PerformanceSource } from "../db/performance";
import type { Habit, HabitLog, Task, TaskCompletion, TaskStatusEvent } from "../db/types";
import { addDays, parseDateKey, toLocalDateKey } from "../utils/date";

function timestamp(date: string, hour = 14): string {
  const value = parseDateKey(date);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

function task(
  id: string,
  title: string,
  created: string,
  overrides: Partial<Task> = {},
): Task {
  return {
    id,
    title,
    status: "todo",
    due_date: null,
    is_urgent: 0,
    parent_goal_id: "goal-growth",
    parent_task_id: null,
    position: 0,
    task_type: "onetime",
    recurrence_type: null,
    recurrence_days: null,
    recurrence_end_date: null,
    created_at: timestamp(created),
    updated_at: timestamp(created),
    ...overrides,
  };
}

function statusEvent(
  id: string,
  taskId: string,
  fromStatus: TaskStatusEvent["from_status"],
  toStatus: TaskStatusEvent["to_status"],
  date: string,
  baseline = false,
): TaskStatusEvent {
  return {
    id,
    task_id: taskId,
    from_status: fromStatus,
    to_status: toStatus,
    occurred_at: timestamp(date),
    is_baseline: baseline ? 1 : 0,
  };
}

export function getPerformanceDemoSource(): PerformanceSource {
  const today = toLocalDateKey();
  const launchCreated = addDays(today, -20);
  const launchStarted = addDays(today, -17);
  const launchDone = addDays(today, -15);
  const proposalCreated = addDays(today, -9);
  const proposalStarted = addDays(today, -6);
  const importedCreated = addDays(today, -43);
  const importedBaseline = addDays(today, -12);
  const dailyCreated = addDays(today, -70);
  const customCreated = addDays(today, -48);
  const dailyHabitCreated = addDays(today, -95);
  const weeklyHabitCreated = addDays(today, -63);

  const tasks: Task[] = [
    task("launch", "Launch the coaching newsletter", launchCreated, {
      status: "done",
      updated_at: timestamp(launchDone),
    }),
    task("proposal", "Prepare partnership proposal", proposalCreated, {
      status: "in_progress",
      parent_goal_id: "goal-business",
      updated_at: timestamp(proposalStarted),
    }),
    task("imported", "Organize the learning backlog", importedCreated, {
      parent_goal_id: null,
      updated_at: timestamp(importedBaseline),
    }),
    task("morning", "Morning planning review", dailyCreated, {
      task_type: "recurring",
      recurrence_type: "daily",
      parent_goal_id: null,
    }),
    task("deepwork", "Deep work block", customCreated, {
      task_type: "recurring",
      recurrence_type: "custom",
      recurrence_days: "[1,3,5]",
      parent_goal_id: "goal-business",
    }),
  ];

  const statusEvents: TaskStatusEvent[] = [
    statusEvent("launch-create", "launch", null, "todo", launchCreated),
    statusEvent("launch-start", "launch", "todo", "in_progress", launchStarted),
    statusEvent("launch-done", "launch", "in_progress", "done", launchDone),
    statusEvent("proposal-create", "proposal", null, "todo", proposalCreated),
    statusEvent("proposal-start", "proposal", "todo", "in_progress", proposalStarted),
    statusEvent("imported-baseline", "imported", null, "todo", importedBaseline, true),
    statusEvent("morning-create", "morning", null, "todo", dailyCreated),
    statusEvent("deepwork-create", "deepwork", null, "todo", customCreated),
  ];

  const taskCompletions: TaskCompletion[] = [];
  for (let date = dailyCreated; date <= today; date = addDays(date, 1)) {
    const offset = Math.abs(parseDateKey(date).getDate() + parseDateKey(date).getMonth());
    if (offset % 7 !== 0 && date !== today) taskCompletions.push({ task_id: "morning", completed_date: date });
  }
  for (let date = customCreated; date <= today; date = addDays(date, 1)) {
    const day = parseDateKey(date).getDay();
    if ([1, 3, 5].includes(day) && parseDateKey(date).getDate() % 5 !== 0) {
      taskCompletions.push({ task_id: "deepwork", completed_date: date });
    }
  }

  const finishedHabitCreated = addDays(today, -80);
  const finishedHabitEnded = addDays(today, -20);
  const habits: Habit[] = [
    { id: "habit-read", name: "Read for 20 minutes", frequency: "daily", created_at: timestamp(dailyHabitCreated), finished_at: null },
    { id: "habit-review", name: "Weekly reflection", frequency: "weekly", created_at: timestamp(weeklyHabitCreated), finished_at: null },
    {
      id: "habit-cold-shower",
      name: "Cold shower",
      frequency: "daily",
      created_at: timestamp(finishedHabitCreated),
      finished_at: timestamp(finishedHabitEnded),
    },
  ];
  const habitLogs: HabitLog[] = [];
  for (let date = dailyHabitCreated; date <= today; date = addDays(date, 1)) {
    if (parseDateKey(date).getDate() % 6 !== 0 && date !== today) {
      habitLogs.push({
        id: `read-${date}`,
        habit_id: "habit-read",
        logged_date: date,
        created_at: timestamp(date),
      });
    }
  }
  for (let date = finishedHabitCreated; date <= finishedHabitEnded; date = addDays(date, 1)) {
    if (parseDateKey(date).getDate() % 4 !== 0) {
      habitLogs.push({
        id: `cold-${date}`,
        habit_id: "habit-cold-shower",
        logged_date: date,
        created_at: timestamp(date),
      });
    }
  }
  for (let date = weeklyHabitCreated; date <= today; date = addDays(date, 7)) {
    habitLogs.push({
      id: `review-${date}`,
      habit_id: "habit-review",
      logged_date: date,
      created_at: timestamp(date),
    });
  }

  return {
    tasks,
    statusEvents,
    taskCompletions,
    habits,
    habitLogs,
    goals: [
      {
        id: "goal-growth",
        title: "Personal growth",
        description: null,
        target_date: null,
        status: "active",
        parent_goal_id: null,
        position: 0,
        created_at: timestamp(addDays(today, -120)),
        updated_at: timestamp(today),
      },
      {
        id: "goal-business",
        title: "Build the business",
        description: null,
        target_date: null,
        status: "active",
        parent_goal_id: null,
        position: 1,
        created_at: timestamp(addDays(today, -90)),
        updated_at: timestamp(today),
      },
    ],
  };
}
