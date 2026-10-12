-- One row per person: their whole dataset as JSON, merged on every sync
-- (src/lib/merge.ts). sub is the Google account id from login.finereli.com.
CREATE TABLE docs (
  sub TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
