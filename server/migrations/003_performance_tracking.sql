CREATE TABLE IF NOT EXISTS task_status_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    is_baseline INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_task_status_events_task_time
    ON task_status_events(task_id, occurred_at);

INSERT INTO task_status_events
    (id, task_id, from_status, to_status, occurred_at, is_baseline)
SELECT
    lower(hex(randomblob(16))),
    id,
    NULL,
    status,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    1
FROM tasks;

CREATE TRIGGER IF NOT EXISTS task_status_event_after_insert
AFTER INSERT ON tasks
BEGIN
    INSERT INTO task_status_events
        (id, task_id, from_status, to_status, occurred_at, is_baseline)
    VALUES
        (lower(hex(randomblob(16))), NEW.id, NULL, NEW.status, NEW.created_at, 0);
END;

CREATE TRIGGER IF NOT EXISTS task_status_event_after_update
AFTER UPDATE OF status ON tasks
WHEN OLD.status <> NEW.status
BEGIN
    INSERT INTO task_status_events
        (id, task_id, from_status, to_status, occurred_at, is_baseline)
    VALUES
        (lower(hex(randomblob(16))), NEW.id, OLD.status, NEW.status, NEW.updated_at, 0);
END;
