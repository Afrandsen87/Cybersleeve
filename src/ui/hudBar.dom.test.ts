// @vitest-environment happy-dom
/**
 * @module ui
 * The top bar draws the credits, and hides the rate while the view has none.
 * Called by: vitest. Calls: buildHud, widgetKit.
 */
import { describe, expect, it } from 'vitest';
import { hudView, tabView } from '../testing/widgetKit';
import { noIcons } from './pixelIcon';
import { buildHud } from './widgets/hud';

const mount = () => buildHud(noIcons, [tabView('character', null)], () => {});

describe('top bar', () => {
  it('shows the label, the bare balance and the rate in its own element', () => {
    const hud = mount();
    hud.render(hudView({ rateText: '+3/s' }));
    expect(hud.root.querySelector('.credits-label')!.textContent).toBe('CREDITS');
    expect(hud.credits.textContent).toBe('12');
    expect(hud.rate.hidden).toBe(false);
    expect(hud.rate.textContent).toBe('+3/s');
  });

  it('hides the rate while the view has none', () => {
    const hud = mount();
    hud.render(hudView({ rateText: '+3/s' }));
    hud.render(hudView({ rateText: null }));
    expect(hud.rate.hidden).toBe(true);
  });
});
