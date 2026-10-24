import { describe, expect, it } from 'vitest';
import { ConfirmGate } from './confirmGate';

describe('ConfirmGate', () => {
  it('starts disarmed', () => {
    expect(new ConfirmGate().isArmed).toBe(false);
  });

  it('the first request only arms the gate, the second confirms and disarms it', () => {
    const gate = new ConfirmGate();
    expect(gate.request()).toBe(false);
    expect(gate.isArmed).toBe(true);
    expect(gate.request()).toBe(true);
    expect(gate.isArmed).toBe(false);
  });

  it('cancelling disarms it, so the next request has to be confirmed again', () => {
    const gate = new ConfirmGate();
    gate.request();
    gate.cancel();
    expect(gate.isArmed).toBe(false);
    expect(gate.request()).toBe(false);
  });

  it('cancelling an unarmed gate is harmless, and every confirmed run needs a fresh pair of requests', () => {
    const gate = new ConfirmGate();
    gate.cancel();
    expect([gate.request(), gate.request(), gate.request(), gate.request()]).toEqual([false, true, false, true]);
  });
});
