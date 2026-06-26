ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'onetime';
ALTER TABLE tasks ADD COLUMN recurrence_type TEXT;
ALTER TABLE tasks ADD COLUMN recurrence_days TEXT;
ALTER TABLE tasks ADD COLUMN recurrence_end_date TEXT;

CREATE TABLE IF NOT EXISTS task_completions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_date TEXT NOT NULL,
  UNIQUE(task_id, completed_date)
);
