import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleSessionExpiry } from "../../../src/app/auth";
afterEach(() => vi.useRealTimers());
describe("Session expiry scheduler", () => {
  it("keeps a thirty-day session authenticated until its real expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const expire = vi.fn();
    const cleanup = scheduleSessionExpiry(30 * 86400000, expire);
    vi.advanceTimersByTime(29 * 86400000);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(86400000);
    expect(expire).toHaveBeenCalledOnce();
    cleanup();
  });
  it("cancels a previous account expiry timer on logout or account switch", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const cleanup = scheduleSessionExpiry(Date.now() + 1000, expire);
    cleanup();
    vi.advanceTimersByTime(2000);
    expect(expire).not.toHaveBeenCalled();
  });
});
