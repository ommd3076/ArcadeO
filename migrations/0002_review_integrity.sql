-- Additive repair: preserve existing match identities and saved payloads.
ALTER TABLE match_registry ADD COLUMN creationPayload TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_distinct_accent ON accounts(accentFamily);
