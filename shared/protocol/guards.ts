import { ActionType, RPSChoice } from "./types";
import { ErrorCode, ErrorDetails, createError } from "./errors";

/**
 * Validates action envelope format and payload integrity.
 */
export function validateActionPayload(
  action: ActionType,
  payload: unknown,
): { valid: true; error?: undefined } | { valid: false; error: ErrorDetails } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      valid: false,
      error: createError(ErrorCode.INVALID_ACTION, "Payload must be an object"),
    };
  }

  const p = payload as Record<string, unknown>;
  const allowedKeys: Partial<Record<ActionType, string[]>> = {
    "connect-four.drop": ["column"],
    "secret.lock": ["choice", "value"],
    "ludo.move": ["tokenId"],
    "ludo.set-colour": ["colourId", "seat"],
    "dots-boxes.edge": ["r1", "c1", "r2", "c2"],
    "sos.place": ["row", "col", "letter"],
    "cricket.choose-role": ["role"],
    "sudoku.edit": ["row", "col", "operation", "value"],
    "match.resign": ["resigningSeat"],
    "challenge.publish": ["senderAttemptId"],
    "match.accept": [],
    "match.decline": [],
    "match.cancel": [],
    "match.ready": [],
    "match.request-abandon": [],
    "match.agree-abandon": [],
    "dice.roll": [],
    "secret.reveal": [],
    "secret.next": [],
    "sudoku.undo": [],
    "sudoku.check": [],
    "sudoku.pause": [],
    "sudoku.resume": [],
  };
  const keys = allowedKeys[action];
  if (!keys || Object.keys(p).some((key) => !keys.includes(key))) {
    return {
      valid: false,
      error: createError(ErrorCode.INVALID_ACTION, "Unknown action or payload field"),
    };
  }

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
      if ((p.choice !== undefined) === (p.value !== undefined)) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Exactly one choice is required"),
        };
      }
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

    case "ludo.set-colour": {
      if (
        !["blue", "green", "red", "yellow", "purple", "orange", "cyan", "pink"].includes(
          p.colourId as string,
        )
      ) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Choose a listed Ludo colour"),
        };
      }
      if (p.seat !== undefined && p.seat !== "A" && p.seat !== "B") {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Choose player A or B"),
        };
      }
      return { valid: true };
    }

    case "dots-boxes.edge": {
      const { r1, c1, r2, c2 } = p;
      for (const [k, v] of Object.entries({ r1, c1, r2, c2 })) {
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 8) {
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
      if (typeof row !== "number" || !Number.isInteger(row) || row < 0 || row > 8) {
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Row must be a non-negative integer"),
        };
      }
      if (typeof col !== "number" || !Number.isInteger(col) || col < 0 || col > 8) {
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

    case "cricket.choose-role": {
      if (p.role !== "bat" && p.role !== "bowl")
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Invalid cricket role"),
        };
      return { valid: true };
    }
    case "challenge.publish": {
      if (typeof p.senderAttemptId !== "string" || !p.senderAttemptId)
        return {
          valid: false,
          error: createError(ErrorCode.INVALID_ACTION, "Sender attempt is required"),
        };
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
