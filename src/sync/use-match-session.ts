import { useEffect, useMemo, useState, useCallback } from "react";
import { MatchSession } from "./match-session";
import type { MatchSessionOptions, MatchSessionState } from "./types";
import type { ActionPayloadMap, ActionType, AcceptedReply } from "../../shared/protocol/types";

export interface UseMatchSessionResult {
  session: MatchSession;
  state: MatchSessionState;
  sendAction: <T extends ActionType>(
    action: T,
    payload: ActionPayloadMap[T],
    options?: {
      expectedVersion?: number;
      roundId?: number;
      turnId?: number;
      controllerGeneration?: number;
      isSecret?: boolean;
    },
  ) => Promise<AcceptedReply>;
  retryPendingAction: () => Promise<AcceptedReply | null>;
  reconcile: () => Promise<void>;
  unmaskSecretChoice: () => void;
  dismissTakeoverNotice: () => void;
  clearError: () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useMatchSession(options: MatchSessionOptions): UseMatchSessionResult {
  const session = useMemo(() => {
    return new MatchSession(options);
  }, [options.matchId, options.actorAccountId, options.baseUrl, options.wsUrl, options.transport]);

  const [state, setState] = useState<MatchSessionState>(() => session.getState());

  useEffect(() => {
    const unsubscribe = session.subscribe((nextState) => {
      setState(nextState);
    });
    session.connect();

    return () => {
      unsubscribe();
      session.disconnect();
    };
  }, [session]);

  const sendAction = useCallback(
    <T extends ActionType>(
      action: T,
      payload: ActionPayloadMap[T],
      actionOptions?: {
        expectedVersion?: number;
        roundId?: number;
        turnId?: number;
        controllerGeneration?: number;
        isSecret?: boolean;
      },
    ) => {
      return session.sendAction(action, payload, actionOptions);
    },
    [session],
  );

  const retryPendingAction = useCallback(() => {
    return session.retryPendingAction();
  }, [session]);

  const reconcile = useCallback(() => {
    return session.reconcile();
  }, [session]);

  const unmaskSecretChoice = useCallback(() => {
    session.unmaskSecretChoice();
  }, [session]);

  const dismissTakeoverNotice = useCallback(() => {
    session.dismissTakeoverNotice();
  }, [session]);

  const clearError = useCallback(() => {
    session.clearError();
  }, [session]);

  const connect = useCallback(() => {
    session.connect();
  }, [session]);

  const disconnect = useCallback(() => {
    session.disconnect();
  }, [session]);

  return {
    session,
    state,
    sendAction,
    retryPendingAction,
    reconcile,
    unmaskSecretChoice,
    dismissTakeoverNotice,
    clearError,
    connect,
    disconnect,
  };
}
