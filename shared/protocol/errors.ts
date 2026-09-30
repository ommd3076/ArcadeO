/**
 * Standard protocol error codes and mapping.
 */

export const ErrorCode = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  PROTOCOL_MISMATCH: "PROTOCOL_MISMATCH",
  UNSUPPORTED_RULES: "UNSUPPORTED_RULES",
  INVALID_ACTION: "INVALID_ACTION",
  STALE_STATE: "STALE_STATE",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  CHOICE_LOCKED: "CHOICE_LOCKED",
  WRONG_ROUND: "WRONG_ROUND",
  CONTROL_TRANSFERRED: "CONTROL_TRANSFERRED",
  MATCH_FINISHED: "MATCH_FINISHED",
  SLOT_OCCUPIED: "SLOT_OCCUPIED",
  ID_REUSED: "ID_REUSED",
  ACTION_SUPERSEDED: "ACTION_SUPERSEDED",
  RATE_LIMITED: "RATE_LIMITED",
  UNAVAILABLE: "UNAVAILABLE",
  PREFERENCE_CONFLICT: "PREFERENCE_CONFLICT",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorDetails {
  code: ErrorCodeType;
  message: string;
  retryable: boolean;
}

export function createError(code: ErrorCodeType, message: string, retryable = false): ErrorDetails {
  return { code, message, retryable };
}
