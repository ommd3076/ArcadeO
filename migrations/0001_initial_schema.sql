-- Migration 0001: Initial Private Arcade D1 Schema
-- Conforms to DATA-MODEL.md and SYSTEM-CONTRACT.md

-- Accounts table (fixed A/B primary key)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY CHECK (id IN ('A', 'B')),
  username TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  kdfAlgorithm TEXT NOT NULL DEFAULT 'PBKDF2-SHA256:600000',
  accentFamily TEXT NOT NULL,
  paletteFamily TEXT NOT NULL,
  preferenceVersion INTEGER NOT NULL DEFAULT 1
);

-- Sessions table (never stores raw session token)
CREATE TABLE IF NOT EXISTS sessions (
  tokenHash TEXT PRIMARY KEY,
  accountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  csrfHash TEXT NOT NULL,
  issuedAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  revokedAt INTEGER,
  sessionId TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_accountId ON sessions(accountId);
CREATE INDEX IF NOT EXISTS idx_sessions_sessionId ON sessions(sessionId);
CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);

-- Login rate limits table
CREATE TABLE IF NOT EXISTS login_limits (
  key TEXT PRIMARY KEY,
  windowStart INTEGER NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  blockedUntil INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_limits_blockedUntil ON login_limits(blockedUntil);

-- Sudoku catalog puzzles table
CREATE TABLE IF NOT EXISTS puzzles (
  puzzleId TEXT NOT NULL,
  catalogVersion INTEGER NOT NULL DEFAULT 1,
  bucket TEXT NOT NULL,
  displayNumber INTEGER NOT NULL,
  givens TEXT NOT NULL,
  solution TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 0,
  sourceDigest TEXT NOT NULL,
  PRIMARY KEY (puzzleId, catalogVersion),
  UNIQUE (catalogVersion, bucket, displayNumber)
);

CREATE INDEX IF NOT EXISTS idx_puzzles_bucket ON puzzles(catalogVersion, bucket);

-- Match registry table
CREATE TABLE IF NOT EXISTS match_registry (
  matchId TEXT PRIMARY KEY,
  creationId TEXT NOT NULL UNIQUE,
  creatorAccountId TEXT NOT NULL REFERENCES accounts(id),
  gameId TEXT NOT NULL,
  mode TEXT NOT NULL,
  participants TEXT NOT NULL,
  doName TEXT NOT NULL,
  initializationState TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  deliveryVersion INTEGER NOT NULL DEFAULT 0,
  schemaVersion INTEGER NOT NULL DEFAULT 1,
  rulesVersion INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  startedAt INTEGER,
  finishedAt INTEGER,
  lastActionAt INTEGER NOT NULL,
  payloadDigest TEXT
);

CREATE INDEX IF NOT EXISTS idx_match_registry_creator ON match_registry(creatorAccountId);
CREATE INDEX IF NOT EXISTS idx_match_registry_lifecycle ON match_registry(lifecycle);
CREATE INDEX IF NOT EXISTS idx_match_registry_lastActionAt ON match_registry(lastActionAt);

-- Active slots table for atomic concurrency and game reservations
CREATE TABLE IF NOT EXISTS active_slots (
  slotKey TEXT PRIMARY KEY,
  matchId TEXT NOT NULL REFERENCES match_registry(matchId),
  creationId TEXT NOT NULL,
  reservedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_slots_matchId ON active_slots(matchId);

-- Results table for completed matches
CREATE TABLE IF NOT EXISTS results (
  matchId TEXT PRIMARY KEY REFERENCES match_registry(matchId),
  projectedVersion INTEGER NOT NULL,
  gameId TEXT NOT NULL,
  mode TEXT NOT NULL,
  participants TEXT NOT NULL,
  winner TEXT,
  reason TEXT NOT NULL,
  scores TEXT,
  finishedAt INTEGER NOT NULL,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_results_gameId ON results(gameId);
CREATE INDEX IF NOT EXISTS idx_results_finishedAt ON results(finishedAt);

-- Sudoku records table
CREATE TABLE IF NOT EXISTS sudoku_records (
  attemptId TEXT NOT NULL,
  accountId TEXT NOT NULL REFERENCES accounts(id),
  puzzleId TEXT NOT NULL,
  mode TEXT NOT NULL,
  elapsedMs INTEGER NOT NULL,
  assisted INTEGER NOT NULL DEFAULT 0,
  replay INTEGER NOT NULL DEFAULT 0,
  completedAt INTEGER NOT NULL,
  resultMatchId TEXT REFERENCES match_registry(matchId),
  PRIMARY KEY (attemptId, accountId)
);

CREATE INDEX IF NOT EXISTS idx_sudoku_records_account_puzzle ON sudoku_records(accountId, puzzleId);
CREATE INDEX IF NOT EXISTS idx_sudoku_records_completedAt ON sudoku_records(completedAt);
