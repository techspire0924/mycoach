import { useEffect, useMemo, useState } from "react";
import type { PerformanceSource } from "../db/performance";
import { useStore } from "../store";
import type { Goal } from "../db/types";
import {
  average,
  computeHabitPerformance,
  computeOneTimePerformance,
  computeRecurringPerformance,
  formatDuration,
  rangeStart,
  statusLabel,
  type HeatmapDay,
  type OneTimePerformance,
  type PerformanceRange,
  type ScheduledPerformance,
} from "../performance/analytics";
import { formatDateKey, parseDateKey, instantDateKey, timestampDate } from "../utils/date";

type Tab = "overview" | "onetime" | "recurring" | "habits";
type OneTimeSort = "created" | "backlog" | "active" | "finished" | "total";

const GLOBAL_RANGES: Array<{ id: PerformanceRange; label: string }> = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "all", label: "All" },
];

const DETAIL_RANGES: Array<{ id: PerformanceRange; label: string }> = [
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "1y", label: "1y" },
  { id: "all", label: "All" },
];

function shortDate(timestamp: string | null): string {
  if (!timestamp) return "Unknown";
  return timestampDate(timestamp).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fullDateTime(timestamp: string): string {
  return timestampDate(timestamp).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rateLabel(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function aggregateRate(items: ScheduledPerformance[]): number | null {
  const completed = items.reduce((sum, item) => sum + item.completed, 0);
  const expected = items.reduce((sum, item) => sum + item.expected, 0);
  return expected ? Math.round((completed / expected) * 100) : null;
}

function RangeButtons({
  value,
  options,
  onChange,
}: {
  value: PerformanceRange;
  options: Array<{ id: PerformanceRange; label: string }>;
  onChange: (range: PerformanceRange) => void;
}) {
  return (
    <div className="performance-range" aria-label="Performance date range">
      {options.map((option) => (
        <button
          key={option.id}
          className={value === option.id ? "active" : ""}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MiniHeatmap({ cells }: { cells: HeatmapDay[] }) {
  return (
    <div className="performance-mini-heatmap" aria-hidden="true">
      {cells.slice(-30).map((cell) => (
        <span key={cell.date} className={`heat-cell heat-cell--${cell.status}`} />
      ))}
    </div>
  );
}

function Heatmap({ cells }: { cells: HeatmapDay[] }) {
  if (!cells.length) {
    return <div className="performance-no-history">No activity in this range.</div>;
  }

  const firstDay = parseDateKey(cells[0].date).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const placeholders = Array.from({ length: mondayOffset });

  return (
    <div className="performance-heatmap-scroll">
      <div className="performance-heatmap-wrap">
        <div className="performance-weekdays" aria-hidden="true">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span>
          <span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
        <div className="performance-heatmap" role="img" aria-label="Calendar performance heatmap">
          {placeholders.map((_, index) => <span key={`blank-${index}`} className="heat-cell heat-cell--blank" />)}
          {cells.map((cell) => {
            const label = `${formatDateKey(cell.date, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}: ${cell.status.replace("_", " ")}`;
            return (
              <span
                key={cell.date}
                className={`heat-cell heat-cell--${cell.status}`}
                title={label}
                aria-label={label}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "done" | "inprogress";
}) {
  return (
    <div className={`performance-metric${tone ? ` performance-metric--${tone}` : ""}`}>
      <span className="performance-metric-label">{label}</span>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function LifecycleDetail({ item }: { item: OneTimePerformance }) {
  const observed = item.events.filter((event) => event.is_baseline !== 1);
  return (
    <div className="performance-detail performance-lifecycle-detail">
      <div className="performance-detail-heading">
        <div>
          <h3>{item.task.title}</h3>
          <span className={`performance-status performance-status--${item.task.status}`}>
            {statusLabel(item.task.status)}
          </span>
        </div>
        {item.hasPartialHistory && item.trackingStartedAt && (
          <span className="performance-partial">
            History tracked since {shortDate(item.trackingStartedAt)}
          </span>
        )}
      </div>

      <div className="lifecycle-track">
        <div className="lifecycle-point">
          <i />
          <strong>Created</strong>
          <span>{shortDate(item.task.created_at)}</span>
        </div>
        <div className="lifecycle-segment">
          <strong>{formatDuration(item.backlogMs)}</strong>
          <span>backlog</span>
        </div>
        <div className={`lifecycle-point${item.startedAt ? "" : " muted"}`}>
          <i />
          <strong>Started</strong>
          <span>{shortDate(item.startedAt)}</span>
        </div>
        <div className="lifecycle-segment">
          <strong>{item.activePartial && item.activeMs !== null ? `${formatDuration(item.activeMs)}+` : formatDuration(item.activeMs)}</strong>
          <span>active</span>
        </div>
        <div className={`lifecycle-point${item.finishedAt ? "" : " muted"}`}>
          <i />
          <strong>Finished</strong>
          <span>{shortDate(item.finishedAt)}</span>
        </div>
      </div>

      <div className="performance-history">
        <span className="performance-section-label">Observed status history</span>
        {observed.length ? (
          observed.map((event) => (
            <div key={event.id} className="performance-history-event">
              <span className={`history-dot history-dot--${event.to_status}`} />
              <span>
                {event.from_status ? `${statusLabel(event.from_status)} → ` : ""}
                <strong>{statusLabel(event.to_status)}</strong>
              </span>
              <time>{fullDateTime(event.occurred_at)}</time>
            </div>
          ))
        ) : (
          <p>No exact transitions have been recorded yet.</p>
        )}
      </div>
    </div>
  );
}

function ScheduledDetail({
  item,
  range,
  setRange,
}: {
  item: ScheduledPerformance;
  range: PerformanceRange;
  setRange: (range: PerformanceRange) => void;
}) {
  return (
    <div className="performance-detail">
      <div className="performance-detail-heading scheduled-detail-heading">
        <div>
          <h3>
            {item.title}
            {item.finishedAt && <span className="performance-finished-tag">Finished</span>}
          </h3>
          <span>
            {item.scheduleLabel} · Created {shortDate(item.createdAt)}
            {item.finishedAt ? ` · Finished ${shortDate(item.finishedAt)}` : ""}
          </span>
        </div>
        <RangeButtons value={range} options={DETAIL_RANGES} onChange={setRange} />
      </div>
      <div className="scheduled-detail-stats">
        <strong>{rateLabel(item.rate)}</strong>
        <span>{item.completed}/{item.expected} completed</span>
        <span>{item.missed} missed</span>
        <span>{item.currentStreak} current streak</span>
        <span>{item.longestStreak} best streak</span>
      </div>
      <Heatmap cells={item.cells} />
      <div className="heatmap-legend">
        <span><i className="heat-cell heat-cell--completed" /> Completed</span>
        <span><i className="heat-cell heat-cell--missed" /> Missed</span>
        <span><i className="heat-cell heat-cell--pending" /> Pending</span>
        <span><i className="heat-cell heat-cell--not_scheduled" /> Not scheduled</span>
        <span><i className="heat-cell heat-cell--extra" /> Extra</span>
      </div>
    </div>
  );
}

function OneTimeTable({
  items,
  goals,
  selectedId,
  onSelect,
}: {
  items: OneTimePerformance[];
  goals: Goal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const goalMap = new Map(goals.map((goal) => [goal.id, goal.title]));
  if (!items.length) return <div className="performance-empty">No one-time tasks match these filters.</div>;

  return (
    <div className="performance-table-wrap">
      <table className="performance-table">
        <thead>
          <tr>
            <th>Task</th><th>Created</th><th>Backlog</th><th>Started</th>
            <th>Active</th><th>Finished</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.task.id}
              className={selectedId === item.task.id ? "selected" : ""}
              onClick={() => onSelect(item.task.id)}
            >
              <td>
                <strong>{item.task.title}</strong>
                <span>{item.task.parent_goal_id ? goalMap.get(item.task.parent_goal_id) ?? "Standalone" : "Standalone"}</span>
              </td>
              <td>{shortDate(item.task.created_at)}</td>
              <td>{formatDuration(item.backlogMs)}</td>
              <td>{shortDate(item.startedAt)}</td>
              <td>{item.activePartial && item.activeMs !== null ? `${formatDuration(item.activeMs)}+` : formatDuration(item.activeMs)}</td>
              <td>{shortDate(item.finishedAt)}</td>
              <td>{formatDuration(item.totalMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduledCards({
  items,
  selectedId,
  onSelect,
}: {
  items: ScheduledPerformance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!items.length) return <div className="performance-empty">No items match this search.</div>;
  return (
    <div className="performance-scheduled-grid">
      {items.map((item) => (
        <button
          key={item.id}
          className={`performance-scheduled-card${selectedId === item.id ? " selected" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          <div className="scheduled-card-heading">
            <div>
              <strong>
                {item.title}
                {item.finishedAt && <span className="performance-finished-tag">Finished</span>}
              </strong>
              <span>
                {item.scheduleLabel} · {shortDate(item.createdAt)}
                {item.finishedAt ? ` → ${shortDate(item.finishedAt)}` : ""}
              </span>
            </div>
            <b>{rateLabel(item.rate)}</b>
          </div>
          <MiniHeatmap cells={item.cells} />
          <div className="scheduled-card-footer">
            <span>{item.completed}/{item.expected} completed</span>
            <span>🔥 {item.currentStreak}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Performance() {
  const sharedSource = useStore(s => s.performanceSource);
  const [demo, setDemo] = useState<PerformanceSource | null>(null);
  const source = demo ?? sharedSource;
  const [range, setRange] = useState<PerformanceRange>("30d");
  const [detailRange, setDetailRange] = useState<PerformanceRange>("1y");
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState("all");
  const [sort, setSort] = useState<OneTimeSort>("created");
  const [selectedOneTime, setSelectedOneTime] = useState<string | null>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<string | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "performance") {
      import("../performance/demo").then(({ getPerformanceDemoSource }) => {
        if (!cancelled) setDemo(getPerformanceDemoSource());
      });
    }
    return () => { cancelled = true; };
  }, []);

  const oneTimeItems = useMemo(() => {
    if (!source) return [];
    return source.tasks
      .filter((task) => task.task_type === "onetime")
      .map((task) => computeOneTimePerformance(task, source.statusEvents));
  }, [source]);

  const recurringItems = useMemo(() => {
    if (!source) return [];
    return source.tasks
      .filter((task) => task.task_type === "recurring")
      .map((task) => computeRecurringPerformance(
        task,
        source.taskCompletions,
        source.statusEvents,
        range,
      ));
  }, [source, range]);

  const habitItems = useMemo(() => {
    if (!source) return [];
    return source.habits
      .map((habit) => computeHabitPerformance(habit, source.habitLogs, range))
      // Active habits lead; finished ones follow, most recently finished first.
      .sort((a, b) => {
        if (!a.finishedAt && !b.finishedAt) return 0;
        if (!a.finishedAt) return -1;
        if (!b.finishedAt) return 1;
        return b.finishedAt.localeCompare(a.finishedAt);
      });
  }, [source, range]);

  if (!source) return <div className="performance-state"><span className="performance-spinner" />Loading performance…</div>;
  if (!source) return null;

  const normalizedSearch = search.trim().toLowerCase();
  const selectedRangeStart = rangeStart(range);
  const backlogItems = oneTimeItems.filter((item) => {
    if (item.backlogMs === null) return false;
    if (!selectedRangeStart) return true;
    // A live backlog belongs in every range that includes today. For started
    // tasks, include the metric when the backlog stage ended in the range.
    return item.task.status === "todo" ||
      Boolean(item.startedAt && instantDateKey(item.startedAt) >= selectedRangeStart);
  });
  const activeItems = oneTimeItems.filter((item) => {
    if (item.activeMs === null || item.activePartial) return false;
    if (!selectedRangeStart) return true;
    // Current in-progress work is active in the selected range even if it
    // started earlier. Completed intervals use their finish timestamp.
    return item.task.status === "in_progress" ||
      Boolean(item.finishedAt && instantDateKey(item.finishedAt) >= selectedRangeStart);
  });
  const backlogAverage = average(backlogItems.map((item) => item.backlogMs));
  const activeAverage = average(activeItems.map((item) => item.activeMs));

  const visibleOneTime = oneTimeItems
    .filter((item) => !normalizedSearch || item.task.title.toLowerCase().includes(normalizedSearch))
    .filter((item) => statusFilter === "all" || item.task.status === statusFilter)
    .filter((item) => goalFilter === "all" || (
      goalFilter === "standalone"
        ? !item.task.parent_goal_id
        : item.task.parent_goal_id === goalFilter
    ))
    .sort((a, b) => {
      const nullable = (value: number | null) => value ?? -1;
      if (sort === "backlog") return nullable(b.backlogMs) - nullable(a.backlogMs);
      if (sort === "active") return nullable(b.activeMs) - nullable(a.activeMs);
      if (sort === "total") return nullable(b.totalMs) - nullable(a.totalMs);
      if (sort === "finished") return (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "");
      return b.task.created_at.localeCompare(a.task.created_at);
    });
  const visibleRecurring = recurringItems.filter((item) =>
    !normalizedSearch || item.title.toLowerCase().includes(normalizedSearch)
  );
  const visibleHabits = habitItems.filter((item) =>
    !normalizedSearch || item.title.toLowerCase().includes(normalizedSearch)
  );

  const selectedOneTimeItem = oneTimeItems.find((item) => item.task.id === selectedOneTime) ?? null;
  const selectedRecurringTask = source.tasks.find((task) => task.id === selectedRecurring) ?? null;
  const selectedHabitItem = source.habits.find((habit) => habit.id === selectedHabit) ?? null;
  const recurringDetail = selectedRecurringTask
    ? computeRecurringPerformance(selectedRecurringTask, source.taskCompletions, source.statusEvents, detailRange)
    : null;
  const habitDetail = selectedHabitItem
    ? computeHabitPerformance(selectedHabitItem, source.habitLogs, detailRange)
    : null;

  function toggleSelection(current: string | null, id: string, setter: (value: string | null) => void) {
    setter(current === id ? null : id);
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "onetime", label: "One-time", count: oneTimeItems.length },
    { id: "recurring", label: "Recurring", count: recurringItems.length },
    { id: "habits", label: "Habits", count: habitItems.length },
  ];

  return (
    <div className="performance-page">
      <div className="performance-page-heading">
        <div>
          <p>See how quickly work moves and how consistently routines happen.</p>
        </div>
        <RangeButtons value={range} options={GLOBAL_RANGES} onChange={setRange} />
      </div>

      <div className="performance-metrics">
        <MetricCard
          label="Avg. backlog"
          value={formatDuration(backlogAverage.value)}
          detail={`${backlogAverage.count} tracked task${backlogAverage.count === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Avg. active"
          value={formatDuration(activeAverage.value)}
          detail={`${activeAverage.count} tracked task${activeAverage.count === 1 ? "" : "s"}`}
          tone="inprogress"
        />
        <MetricCard
          label="Recurring"
          value={rateLabel(aggregateRate(recurringItems))}
          detail="scheduled completion"
          tone="done"
        />
        <MetricCard
          label="Habits"
          value={rateLabel(aggregateRate(habitItems))}
          detail="consistency"
          tone="done"
        />
      </div>

      <div className="performance-toolbar">
        <div className="performance-tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}{item.count !== undefined && <span>{item.count}</span>}
            </button>
          ))}
        </div>
        <input
          className="performance-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search action items…"
          aria-label="Search performance items"
        />
      </div>

      {(tab === "overview" || tab === "onetime") && (
        <section className="performance-section">
          <div className="performance-section-heading">
            <div>
              <span className="performance-section-label">One-time tasks</span>
              <p>Lifecycle timing from backlog through completion.</p>
            </div>
            {tab === "onetime" && (
              <div className="performance-filters">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="todo">Backlog</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)}>
                  <option value="all">All goals</option>
                  <option value="standalone">Standalone</option>
                  {source.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value as OneTimeSort)}>
                  <option value="created">Newest created</option>
                  <option value="backlog">Longest backlog</option>
                  <option value="active">Longest active</option>
                  <option value="finished">Latest finished</option>
                  <option value="total">Longest total</option>
                </select>
              </div>
            )}
          </div>
          <OneTimeTable
            items={tab === "overview" ? visibleOneTime.slice(0, 5) : visibleOneTime}
            goals={source.goals}
            selectedId={selectedOneTime}
            onSelect={(id) => toggleSelection(selectedOneTime, id, setSelectedOneTime)}
          />
          {selectedOneTimeItem && <LifecycleDetail item={selectedOneTimeItem} />}
        </section>
      )}

      {(tab === "overview" || tab === "recurring") && (
        <section className="performance-section">
          <div className="performance-section-heading">
            <div>
              <span className="performance-section-label">Recurring tasks</span>
              <p>Completion against each item’s actual schedule.</p>
            </div>
          </div>
          <ScheduledCards
            items={tab === "overview" ? visibleRecurring.slice(0, 4) : visibleRecurring}
            selectedId={selectedRecurring}
            onSelect={(id) => toggleSelection(selectedRecurring, id, setSelectedRecurring)}
          />
          {recurringDetail && <ScheduledDetail item={recurringDetail} range={detailRange} setRange={setDetailRange} />}
        </section>
      )}

      {(tab === "overview" || tab === "habits") && (
        <section className="performance-section">
          <div className="performance-section-heading">
            <div>
              <span className="performance-section-label">Habits</span>
              <p>Daily and weekly consistency since creation.</p>
            </div>
          </div>
          <ScheduledCards
            items={tab === "overview" ? visibleHabits.slice(0, 4) : visibleHabits}
            selectedId={selectedHabit}
            onSelect={(id) => toggleSelection(selectedHabit, id, setSelectedHabit)}
          />
          {habitDetail && <ScheduledDetail item={habitDetail} range={detailRange} setRange={setDetailRange} />}
        </section>
      )}

      {!oneTimeItems.length && !recurringItems.length && !habitItems.length && (
        <div className="performance-empty performance-empty--page">
          <span>📈</span>
          <strong>Your performance story starts with an action item.</strong>
          <p>Create a task or habit, then return here to see its progress.</p>
        </div>
      )}
    </div>
  );
}
