import { describe, expect, it } from 'vitest';
import { createIconSource, noIcons, renderIconSvg, type IconSet } from './pixelIcon';

const palette = { k: '#000000', y: '#ffe94d' };
const set: IconSet = {
  size: 2,
  palette,
  grids: { dot: ['k.', '.y'], bar: ['kk', '..'] },
  assignment: { 'action-a': 'dot' },
};

describe('renderIconSvg', () => {
  it('draws opaque pixels only, merging neighbours of one colour in a row', () => {
    const svg = renderIconSvg(['kk', '.y'], palette, 'x');
    expect(svg).toContain('<rect x="0" y="0" width="2" height="1" fill="#000000"/>');
    expect(svg).toContain('<rect x="1" y="1" width="1" height="1" fill="#ffe94d"/>');
    expect(svg.match(/<rect/g)).toHaveLength(2);
    expect(svg).toContain('viewBox="0 0 2 2"');
    expect(svg).toContain('crispEdges');
  });

  it('draws nothing for a fully transparent grid', () => {
    expect(renderIconSvg(['..', '..'], palette, 'x')).not.toContain('<rect');
  });

  it('rejects a row of the wrong length', () => {
    expect(() => renderIconSvg(['kk', 'k'], palette, 'x')).toThrow(/row 1/);
  });

  it('rejects a character that is not in the palette', () => {
    expect(() => renderIconSvg(['kz', '..'], palette, 'x')).toThrow(/"z".*not in the palette/);
  });
});

describe('createIconSource', () => {
  it('returns a CSS image for an assigned entity and null for any other', () => {
    const source = createIconSource(set);
    expect(source.urlFor('action-a')).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(source.urlFor('unknown')).toBeNull();
  });

  it('rejects an assignment to an icon that does not exist', () => {
    expect(() => createIconSource({ ...set, assignment: { x: 'missing' } })).toThrow(/unknown icon "missing"/);
  });

  it('rejects a grid with the wrong number of rows', () => {
    expect(() => createIconSource({ ...set, grids: { bad: ['kk'] } })).toThrow(/1 rows, expected 2/);
  });
});

describe('noIcons', () => {
  it('has no icon for anything', () => {
    expect(noIcons.urlFor('action-a')).toBeNull();
  });
});
