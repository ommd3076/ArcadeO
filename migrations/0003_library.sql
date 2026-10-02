-- Personal favourites and one shared, versioned play-next list.
CREATE TABLE IF NOT EXISTS account_favourites (
  accountId TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  gameIds TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shared_play_next (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  gameIds TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO shared_play_next (id, gameIds, version) VALUES (1, '[]', 1);
