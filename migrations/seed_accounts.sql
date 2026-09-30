-- Provisioned accounts seed
INSERT INTO accounts (id, username, displayName, passwordHash, salt, kdfAlgorithm, accentFamily, paletteFamily, preferenceVersion)
VALUES
  ('A', 'player_a', 'Player A', '0beaa9874fc01f8bdebfd0ca2dced4ec17d40078f2fa3234839cb779f66b5ddd', 'b39b8693630ba3d8a6e21c912db42d8e', 'PBKDF2-SHA256:600000', 'teal', 'standard', 1),
  ('B', 'player_b', 'Player B', 'cecaaad50115f11fbf7bd7a12a2ac8ad7f259a6c3c596b85f583576cd5ca75f9', '70895b337c4f29784b5078663b09884d', 'PBKDF2-SHA256:600000', 'violet', 'romantic', 1)
ON CONFLICT(id) DO UPDATE SET
  username = excluded.username,
  displayName = excluded.displayName,
  passwordHash = excluded.passwordHash,
  salt = excluded.salt,
  kdfAlgorithm = excluded.kdfAlgorithm,
  accentFamily = excluded.accentFamily,
  paletteFamily = excluded.paletteFamily,
  preferenceVersion = excluded.preferenceVersion;
