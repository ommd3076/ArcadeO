import { describe, it, expect } from "vitest";
import { validateActionPayload } from "../../shared/protocol/guards";
import { ErrorCode } from "../../shared/protocol/errors";

describe("Protocol Payload Validation", () => {
  it("validates connect-four.drop", () => {
    expect(validateActionPayload("connect-four.drop", { column: 3 }).valid).toBe(true);
    const res = validateActionPayload("connect-four.drop", { column: -1 });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
    }
    expect(validateActionPayload("connect-four.drop", { column: 7 }).valid).toBe(false);
    expect(validateActionPayload("connect-four.drop", { column: 3.5 }).valid).toBe(false);
  });

  it("validates secret.lock for RPS and Hand Cricket", () => {
    expect(validateActionPayload("secret.lock", { choice: "rock" }).valid).toBe(true);
    expect(validateActionPayload("secret.lock", { choice: "lizard" }).valid).toBe(false);
    expect(validateActionPayload("secret.lock", { value: 6 }).valid).toBe(true);
    expect(validateActionPayload("secret.lock", { value: 7 }).valid).toBe(false);
    expect(validateActionPayload("secret.lock", {}).valid).toBe(false);
  });

  it("validates ludo.move", () => {
    expect(validateActionPayload("ludo.move", { tokenId: 0 }).valid).toBe(true);
    expect(validateActionPayload("ludo.move", { tokenId: 3 }).valid).toBe(true);
    expect(validateActionPayload("ludo.move", { tokenId: 4 }).valid).toBe(false);
  });

  it("validates sudoku.edit", () => {
    expect(
      validateActionPayload("sudoku.edit", { row: 0, col: 0, operation: "set", value: 5 }).valid,
    ).toBe(true);
    expect(
      validateActionPayload("sudoku.edit", { row: 9, col: 0, operation: "set", value: 5 }).valid,
    ).toBe(false);
    expect(
      validateActionPayload("sudoku.edit", { row: 0, col: 0, operation: "set", value: 0 }).valid,
    ).toBe(false);
  });
});
