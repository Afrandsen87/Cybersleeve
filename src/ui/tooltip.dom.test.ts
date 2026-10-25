// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { installTooltips, TipRegistry } from './tooltip';

/** Fires a bubbling event with a related target, like the browser does when the pointer moves between elements. */
function fire(target: Element, type: string, relatedTarget: Element | null = null): void {
  const event = new MouseEvent(type, { bubbles: true, relatedTarget });
  target.dispatchEvent(event);
}

function setup() {
  document.body.innerHTML = '<div id="a"><span id="inner">x</span></div><div id="b">no tip</div>';
  const tips = new TipRegistry();
  const a = document.getElementById('a')!;
  let text = 'first tip';
  let reads = 0;
  tips.set(a, () => {
    reads++;
    return text;
  });
  const control = installTooltips(document, tips);
  const box = document.querySelector<HTMLElement>('.tooltip')!;
  return {
    box,
    a,
    tips,
    control,
    setText: (t: string) => (text = t),
    reads: () => reads,
    inner: document.getElementById('inner')!,
    b: document.getElementById('b')!,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('installTooltips', () => {
  it('adds one hidden tooltip box', () => {
    const { box } = setup();
    expect(box.hidden).toBe(true);
    expect(document.querySelectorAll('.tooltip')).toHaveLength(1);
  });

  it('shows the tip of the hovered element, or of its tipped ancestor, and positions it', () => {
    const { box, inner } = setup();
    fire(inner, 'mouseover');
    expect(box.hidden).toBe(false);
    expect(box.textContent).toBe('first tip');
    expect(box.style.left).toMatch(/px$/);
    expect(box.style.top).toMatch(/px$/);
  });

  it('hides when the pointer leaves, but not when it only moves between children of the anchor', () => {
    const { box, a, inner, b } = setup();
    fire(a, 'mouseover');
    fire(a, 'mouseout', inner);
    expect(box.hidden).toBe(false);
    fire(a, 'mouseout', b);
    expect(box.hidden).toBe(true);
  });

  it('ignores elements without a tip', () => {
    const { box, b } = setup();
    fire(b, 'mouseover');
    expect(box.hidden).toBe(true);
  });

  it('shows on keyboard focus and hides on blur', () => {
    const { box, a } = setup();
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(box.hidden).toBe(false);
    a.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(box.hidden).toBe(true);
  });

  it('stays current: refresh re-reads the text of the tooltip that is showing', () => {
    const { box, a, control, setText } = setup();
    fire(a, 'mouseover');
    setText('second tip');
    control.refresh();
    expect(box.textContent).toBe('second tip');
  });

  it('builds no text for elements nobody hovers, and refresh does nothing while nothing shows', () => {
    const { control, reads } = setup();
    control.refresh();
    expect(reads()).toBe(0);
  });

  it('refresh with unchanged text does not measure or move the box again', () => {
    const { box, a, control } = setup();
    fire(a, 'mouseover');
    box.style.left = '123px';
    control.refresh();
    expect(box.style.left).toBe('123px');
  });

  it('hides when the shown tip becomes empty or is removed', () => {
    const { box, a, control, setText, tips } = setup();
    fire(a, 'mouseover');
    setText('');
    control.refresh();
    expect(box.hidden).toBe(true);
    setText('again');
    fire(a, 'mouseover');
    expect(box.hidden).toBe(false);
    tips.set(a, null);
    expect(a.hasAttribute('data-tip')).toBe(false);
    control.refresh();
    expect(box.hidden).toBe(true);
  });
});

describe('TipRegistry', () => {
  it('marks an element once and replaces its text function without touching the DOM again', () => {
    const el = document.createElement('div');
    const tips = new TipRegistry();
    tips.set(el, () => 'one');
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((r) => records.push(...r));
    observer.observe(el, { attributes: true });
    tips.set(el, () => 'two');
    expect(observer.takeRecords()).toEqual([]);
    expect(tips.textOf(el)).toBe('two');
    expect(tips.textOf(document.createElement('div'))).toBe('');
  });
});
