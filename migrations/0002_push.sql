-- One row per device that turned reminders on. No account needed and no habit
-- names: the service worker picks the habit from what's on the device. The
-- server only knows when to send (minutes after local midnight in tz) and
-- whether a shot was logged today (last_shot_day, the device's local date).
CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY,
  minutes INTEGER NOT NULL,
  tz TEXT NOT NULL,
  last_shot_day TEXT,
  last_sent_day TEXT,
  last_test_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
