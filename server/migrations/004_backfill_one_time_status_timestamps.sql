-- Migration 003 began exact status-event tracking, but tasks that had already
-- started or finished received only a baseline snapshot. Use their last known
-- update time to seed the missing milestone so Performance can calculate the
-- corresponding lifecycle metrics.

INSERT INTO task_status_events
    (id, task_id, from_status, to_status, occurred_at, is_baseline)
SELECT
    lower(hex(randomblob(16))),
    task.id,
    'todo',
    'in_progress',
    task.updated_at,
    0
FROM tasks AS task
WHERE task.task_type = 'onetime'
  AND task.status = 'in_progress'
  AND EXISTS (
      SELECT 1
      FROM task_status_events AS baseline
      WHERE baseline.task_id = task.id
        AND baseline.is_baseline = 1
  )
  AND NOT EXISTS (
      SELECT 1
      FROM task_status_events AS exact_start
      WHERE exact_start.task_id = task.id
        AND exact_start.is_baseline = 0
        AND exact_start.to_status = 'in_progress'
  );

INSERT INTO task_status_events
    (id, task_id, from_status, to_status, occurred_at, is_baseline)
SELECT
    lower(hex(randomblob(16))),
    task.id,
    'in_progress',
    'done',
    task.updated_at,
    0
FROM tasks AS task
WHERE task.task_type = 'onetime'
  AND task.status = 'done'
  AND EXISTS (
      SELECT 1
      FROM task_status_events AS baseline
      WHERE baseline.task_id = task.id
        AND baseline.is_baseline = 1
  )
  AND NOT EXISTS (
      SELECT 1
      FROM task_status_events AS exact_finish
      WHERE exact_finish.task_id = task.id
        AND exact_finish.is_baseline = 0
        AND exact_finish.to_status = 'done'
  );
