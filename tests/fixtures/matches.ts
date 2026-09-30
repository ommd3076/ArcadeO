import { AccountId, FilteredMatchView, Seat } from "../../shared/protocol/types";

export const TEST_ACCOUNTS = {
  A: {
    id: "A" as AccountId,
    username: "player_a",
    displayName: "Player One",
    accentFamily: "teal" as const,
    paletteFamily: "standard" as const,
  },
  B: {
    id: "B" as AccountId,
    username: "player_b",
    displayName: "Player Two",
    accentFamily: "violet" as const,
    paletteFamily: "romantic" as const,
  },
};

export function createMockFilteredView(
  overrides: Partial<FilteredMatchView> = {},
): FilteredMatchView {
  return {
    matchId: "match-fixture-001",
    gameId: "connect-four",
    mode: "together",
    lifecycle: "active",
    deliveryVersion: 1,
    participants: {
      A: { accountId: "A", displayName: "Player One", ready: true },
      B: { accountId: "B", displayName: "Player Two", ready: true },
    },
    controller: {
      controllingAccountId: "A",
      controllerGeneration: 1,
      isController: true,
    },
    gameState: {},
    turnSeat: "A" as Seat,
    turnId: 1,
    legalActions: ["connect-four.drop", "match.resign"],
    serverTime: 1700000000000,
    ...overrides,
  };
}
