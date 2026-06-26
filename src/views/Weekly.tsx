import { useStore } from "../store";

export default function Weekly() {
  const { weeklySummary, goals } = useStore();

  if (!weeklySummary) return <div className="empty-state"><p>Loading...</p></div>;

  const { done, remaining } = weeklySummary;
  const goalMap = new Map(goals.map((g) => [g.id, g]));
  const completionRate = done.length + remaining.length > 0
    ? Math.round((done.length / (done.length + remaining.length)) * 100)
    : 0;

  const urgentRemaining = remaining.filter((t) => t.is_urgent === 1);

  return (
    <>
      <div className="week-stats">
        <div className="week-stat">
          <div className="week-stat-num">{done.length}</div>
          <div className="week-stat-label">Completed this week</div>
        </div>
        <div className="week-stat">
          <div className="week-stat-num">{remaining.length}</div>
          <div className="week-stat-label">Carrying forward</div>
        </div>
        <div className="week-stat">
          <div className="week-stat-num">{urgentRemaining.length}</div>
          <div className="week-stat-label">Urgent remaining</div>
        </div>
        <div className="week-stat">
          <div className="week-stat-num" style={{ color: completionRate >= 70 ? "var(--done)" : completionRate >= 40 ? "var(--inprogress)" : "var(--urgent)" }}>
            {completionRate}%
          </div>
          <div className="week-stat-label">Completion rate</div>
        </div>
      </div>

      <div className="week-section">
        <div className="week-section-title">
          <span style={{ color: "var(--done)" }}>✓</span> Done this week ({done.length})
        </div>
        {done.length === 0 && (
          <p style={{ color: "var(--text2)", fontSize: 14 }}>Nothing completed yet — keep going!</p>
        )}
        {done.map((t) => (
          <div key={t.id} className="week-row">
            <span style={{ color: "var(--done)" }}>✓</span>
            <span>{t.title}</span>
            {t.parent_goal_id && goalMap.get(t.parent_goal_id) && (
              <span className="week-row-label">{goalMap.get(t.parent_goal_id)!.title}</span>
            )}
          </div>
        ))}
      </div>

      <div className="week-section">
        <div className="week-section-title">
          <span style={{ color: "var(--text2)" }}>→</span> Carrying to next week ({remaining.length})
        </div>
        {remaining.length === 0 && (
          <p style={{ color: "var(--done)", fontSize: 14 }}>All clear! Nothing remaining.</p>
        )}
        {remaining.map((t) => (
          <div key={t.id} className="week-row">
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.is_urgent === 1 ? "var(--urgent)" : "var(--text2)", flexShrink: 0 }} />
            <span style={{ color: "var(--text2)" }}>{t.title}</span>
            {t.is_urgent === 1 && <span className="tag tag-urgent" style={{ fontSize: 10 }}>Urgent</span>}
            {t.parent_goal_id && goalMap.get(t.parent_goal_id) && (
              <span className="week-row-label">{goalMap.get(t.parent_goal_id)!.title}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
