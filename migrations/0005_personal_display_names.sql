-- Owner-requested display names. Keep credentials, preferences and match history intact.
-- Bump the preference revision so an older profile edit cannot overwrite the rename.
UPDATE accounts
SET displayName = 'Sly fox 🦊', preferenceVersion = preferenceVersion + 1
WHERE id = 'A' AND displayName <> 'Sly fox 🦊';

UPDATE accounts
SET displayName = 'Dumb Bunny 🐰', preferenceVersion = preferenceVersion + 1
WHERE id = 'B' AND displayName <> 'Dumb Bunny 🐰';
