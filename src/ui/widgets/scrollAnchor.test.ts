/** @module ui
 * Injected-frame scroll anchoring coverage. Called by: Vitest. Calls: createScrollAnchor.
 */
import { describe, expect, it } from 'vitest';
import { createScrollAnchor } from './scrollAnchor';

/** Fake page/clock kit shared by anchoring cases; no browser timers.
 * Called by: anchoring tests. Calls: createScrollAnchor.
 * @returns mutable measurements and deterministic frame driver
 */
function kit() {
  let time = 0;
  let top = 100;
  let room = 100;
  let frames: Array<() => void> = [];
  const scrolls: number[] = [];
  const growth: number[] = [];
  const anchor = createScrollAnchor({
    now: () => time,
    requestFrame: (callback) => {
      frames.push(callback);
    },
    measureTop: () => top,
    roomBelow: () => room,
    growSpacer: (px) => {
      growth.push(px);
      room += px;
    },
    scrollBy: (dy) => {
      scrolls.push(dy);
      top -= dy;
      room -= dy;
    },
  });
  return {
    anchor,
    scrolls,
    growth,
    move: (dy: number) => {
      top += dy;
    },
    room: (px: number) => {
      room = px;
    },
    frame: (at: number) => {
      time = at;
      const callbacks = frames;
      frames = [];
      for (const callback of callbacks) callback();
    },
    pending: () => frames.length,
  };
}

describe('scroll anchor', () => {
  it('compensates movement during the transition and stops after 350ms', () => {
    const page = kit();
    page.anchor.start();
    page.move(20);
    page.frame(16);
    page.move(-10);
    page.frame(350);
    page.move(30);
    page.frame(351);
    expect(page.scrolls).toEqual([20, -10]);
    expect(page.pending()).toBe(0);
  });
  it('a newer run cancels previously queued callbacks and captures the new position', () => {
    const page = kit();
    page.anchor.start();
    page.move(20);
    page.anchor.start();
    page.move(10);
    page.frame(16);
    expect(page.scrolls).toEqual([10]);
    expect(page.pending()).toBe(1);
    page.anchor.cancel();
    page.move(40);
    page.frame(32);
    expect(page.scrolls).toEqual([10]);
    expect(page.pending()).toBe(0);
  });
  it('grows only the missing room for downward movement', () => {
    const page = kit();
    page.room(5);
    page.anchor.start();
    page.move(20);
    page.frame(16);
    expect(page.growth).toEqual([15]);
    page.move(-30);
    page.frame(32);
    page.move(10);
    page.frame(48);
    expect(page.growth).toEqual([15]);
    expect(page.scrolls).toEqual([20, -30, 10]);
  });
  it('ignores sub-pixel and non-finite movement', () => {
    const page = kit();
    page.anchor.start();
    page.move(0.75);
    page.frame(16);
    expect(page.scrolls).toEqual([]);
    page.move(0.75);
    page.frame(32);
    expect(page.scrolls).toEqual([1.5]);
    page.move(Number.NaN);
    page.frame(48);
    expect(page.scrolls).toEqual([1.5]);
  });
});
