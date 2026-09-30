import { ActionType, RPSChoice } from "./types";
import { ErrorCode, ErrorDetails, createError } from "./errors";

/**
 * Validates action envelope format and payload integrity.
 */
export function validateActionPayload(
  action: ActionType,
  payload: unknown,
): { valid: true; error?: undefined } | { valid: false; error: ErrorDetails } {
  if (typeof payload !== "object" || payload === null) {
    return {
      valid: false,
      error: createError(ErrorCode.INVALID_ACTION, "Payload must be an object"),
    };
  }

  const p = payload as Record<string, unknown>;

  switch (action) {
    case "connect-four.drop": {
      const col = p.column;
      if (typeof col !== "number" || !Number.isInteger(col) || col < 0 || col > 6) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Column must be an integer between 0 and 6"),
        };
      }
      return { valid: true };
    }

    case "secret.lock": {
      // RPS choice or Hand cricket value
      if (p.choice !== undefined) {
        const choice = p.choice as RPSChoice;
        if (!["rock", "paper", "scissors"].includes(choice)) {
          return {
            valid: false,
            error: createError(ErrorCode.INVALID_ACTION, "Invalid RPS choice"),
          };
        }
      }
      if (p.value !== undefined) {
        const val = p.value;
        if (typeof val !== "number" || !Number.isInteger(val) || val < 1 || val > 6) {
          return {
            valid: false,
            error: createError(
              ErrorCode.INVALID_ACTION,
              "Hand cricket value must be an integer from 1 to 6",
            ),
          };
        }
      }
      if (p.choice === undefined && p.value === undefined) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Choice or value must be specified"),
        };
      }
      return { valid: true };
    }

    case "ludo.move": {
      const tokenId = p.tokenId;
      if (typeof tokenId !== "number" || !Number.isInteger(tokenId) || tokenId < 0 || tokenId > 3) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Token ID must be an integer 0..3"),
        };
      }
      return { valid: true };
    }

    case "dots-boxes.edge": {
      const { r1, c1, r2, c2 } = p;
      for (const [k, v] of Object.entries({ r1, c1, r2, c2 })) {
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
          return {
            valid: false,
            error: createError(ErrorCode.INVALID_ACTION, `${k} must be a non-negative integer`),
          };
        }
      }
      return { valid: true };
    }

    case "sos.place": {
      const { row, col, letter } = p;
      if (typeof row !== "number" || !Number.isInteger(row) || row < 0) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Row must be a non-negative integer"),
        };
      }
      if (typeof col !== "number" || !Number.isInteger(col) || col < 0) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Col must be a non-negative integer"),
        };
      }
      if (letter !== "S" && letter !== "O") {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Letter must be 'S' or 'O'"),
        };
      }
      return { valid: true };
    }

    case "sudoku.edit": {
      const { row, col, operation, value } = p;
      if (typeof row !== "number" || !Number.isInteger(row) || row < 0 || row > 8) {
        return { valid: false, error: createError(ErrorCode.INVALID_ACTION, "Row must be 0..8") };
      }
      if (typeof col !== "number" || !Number.isInteger(col) || col < 0 || col > 8) {
        return { valid: false, error: createError(ErrorCode.INVALID_ACTION, "Col must be 0..8") };
      }
      if (!["set", "erase", "toggle-note"].includes(operation as string)) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Invalid Sudoku operation"),
        };
      }
      if (operation === "set" || operation === "toggle-note") {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 9) {
          return {
            valid: false,
            error: createError(ErrorCode.INVALID_ACTION, "Sudoku value must be 1..9"),
          };
        }
      }
      return { valid: true };
    }

    case "match.resign": {
      if (p.resigningSeat !== undefined && p.resigningSeat !== "A" && p.resigningSeat !== "B") {
        return {
          valid: false,
          error: createError(
            ErrorCode.INVALID_ACTION,
            "resigningSeat must be 'A' or 'B' if specified",
          ),
        };
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}
