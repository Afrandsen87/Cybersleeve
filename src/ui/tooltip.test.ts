import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltip';

const viewport = { width: 1000, height: 700 };
const tip = { width: 200, height: 80 };

describe('placeTooltip', () => {
  it('puts the tooltip above the anchor, left edges aligned', () => {
    const spot = placeTooltip({ left: 300, top: 400, width: 44, height: 44 }, tip, viewport);
    expect(spot).toEqual({ left: 300, top: 400 - 6 - 80 });
  });

  it('flips below the anchor when there is no room above', () => {
    const spot = placeTooltip({ left: 300, top: 20, width: 44, height: 44 }, tip, viewport);
    expect(spot.top).toBe(20 + 44 + 6);
  });

  it('shifts left so the right edge stays inside the window', () => {
    const spot = placeTooltip({ left: 950, top: 400, width: 44, height: 44 }, tip, viewport);
    expect(spot.left).toBe(1000 - 200 - 8);
  });

  it('never goes past the left or bottom edge', () => {
    expect(placeTooltip({ left: -50, top: 400, width: 44, height: 44 }, tip, viewport).left).toBe(8);
    const low = placeTooltip({ left: 300, top: 690, width: 44, height: 44 }, { width: 200, height: 400 }, viewport);
    expect(low.top + 400).toBeLessThanOrEqual(700 - 8);
  });

  it('a tooltip larger than the window sticks to the top-left margin', () => {
    expect(placeTooltip({ left: 300, top: 400, width: 44, height: 44 }, { width: 2000, height: 2000 }, viewport)).toEqual({
      left: 8,
      top: 8,
    });
  });
});
