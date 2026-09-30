export type AccountId = "A" | "B";

export interface AccountRecord {
  id: AccountId;
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  kdfAlgorithm: string;
  accentFamily: string;
  paletteFamily: string;
  preferenceVersion: number;
}

export interface SafeProfile {
  id: AccountId;
  username: string;
  displayName: string;
  accentFamily: string;
  paletteFamily: string;
  preferenceVersion: number;
}

export interface SessionRecord {
  tokenHash: string;
  accountId: AccountId;
  csrfHash: string;
  issuedAt: number;
  expiresAt: number;
  revokedAt: number | null;
  sessionId: string;
}

export interface LoginLimitsRecord {
  key: string;
  windowStart: number;
  failures: number;
  blockedUntil: number;
}

export interface AuthSessionResponse {
  authenticated: true;
  profile: SafeProfile;
  csrfToken: string;
  expiresAt: number;
}

export interface UnauthenticatedResponse {
  authenticated: false;
}

export interface LoginSuccessResponse {
  success: true;
  profile: SafeProfile;
  csrfToken: string;
  expiresAt: number;
}

export interface AuthErrorResponse {
  error: string;
  code: string;
}
