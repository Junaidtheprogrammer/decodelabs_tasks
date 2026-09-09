CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS owners (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 2 AND 50)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 80),
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK(status IN ('queued', 'in-progress', 'completed')),
  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
  category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 2 AND 30),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'deleted')),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
