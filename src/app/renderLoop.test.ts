import { describe, expect, it } from 'vitest';
import { type FrameScheduler, RenderLoop } from './renderLoop';

/** A frame clock the test advances by hand. */
class FakeFrames implements FrameScheduler {
  private next = 1;
  private readonly pending = new Map<number, () => void>();
  request(callback: () => void): number {
    const handle = this.next++;
    this.pending.set(handle, callback);
    return handle;
  }
  cancel(handle: number): void {
    this.pending.delete(handle);
  }
  /** Delivers one display frame to everything requested so far. */
  frame(): void {
    const due = [...this.pending.values()];
    this.pending.clear();
    for (const callback of due) callback();
  }
  get waiting(): number {
    return this.pending.size;
  }
}

function setup(options: { allow?: () => boolean; hidden?: () => boolean; render?: () => void; onError?: (e: unknown) => void } = {}) {
  const frames = new FakeFrames();
  let renders = 0;
  const loop = new RenderLoop(
    frames,
    options.render ??
      (() => {
        renders++;
      }),
    { mayRender: options.allow ?? (() => true), hidden: options.hidden ?? (() => false), onError: options.onError ?? (() => {}) },
  );
  return { frames, loop, renders: () => renders };
}

describe('RenderLoop', () => {
  it('renders once per display frame while the rate limit allows it', () => {
    const { frames, loop, renders } = setup();
    loop.start();
    frames.frame();
    frames.frame();
    frames.frame();
    expect(renders()).toBe(3);
  });

  it('skips frames the rate limit refuses, and keeps asking for frames', () => {
    let allowed = false;
    const { frames, loop, renders } = setup({ allow: () => allowed });
    loop.start();
    frames.frame();
    expect(renders()).toBe(0);
    expect(frames.waiting).toBe(1);
    allowed = true;
    frames.frame();
    expect(renders()).toBe(1);
  });

  it('does not render while the page is hidden, and does not consume the rate limit', () => {
    let asked = 0;
    let hidden = true;
    const { frames, loop, renders } = setup({
      hidden: () => hidden,
      allow: () => {
        asked++;
        return true;
      },
    });
    loop.start();
    frames.frame();
    expect(renders()).toBe(0);
    expect(asked).toBe(0);
    hidden = false;
    frames.frame();
    expect(renders()).toBe(1);
  });

  it('survives a failing refresh, reports it, and keeps going', () => {
    const errors: unknown[] = [];
    let calls = 0;
    const { frames, loop } = setup({
      render: () => {
        calls++;
        if (calls === 1) throw new Error('boom');
      },
      onError: (e) => errors.push(e),
    });
    loop.start();
    frames.frame();
    frames.frame();
    expect(errors).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it('start is idempotent and stop ends the loop', () => {
    const { frames, loop, renders } = setup();
    loop.start();
    loop.start();
    expect(frames.waiting).toBe(1);
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
    frames.frame();
    expect(renders()).toBe(0);
    expect(frames.waiting).toBe(0);
  });

  it('stopping from inside a refresh does not schedule another frame', () => {
    const frames = new FakeFrames();
    const loop: RenderLoop = new RenderLoop(frames, () => loop.stop(), { mayRender: () => true, hidden: () => false });
    loop.start();
    frames.frame();
    expect(frames.waiting).toBe(0);
  });
});
