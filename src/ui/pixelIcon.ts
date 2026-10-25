/**
 * @module ui/pixelIcon
 *
 * Turns pixel-art grids (rows of characters) into small images, and looks the right one up for a game entity.
 * Pure: no DOM access, so it is tested without a browser.
 */

/** Everything needed to draw and assign icons (the shape of `content/icons.ts`, passed in so tests can use their own). */
export interface IconSet {
  /** Pixels per side of every grid. */
  readonly size: number;
  /** Colour (`#rrggbb`) of each grid character; `.` is transparent and must not be listed. */
  readonly palette: Readonly<Record<string, string>>;
  /** The grids by icon name: `size` rows of `size` characters. */
  readonly grids: Readonly<Record<string, readonly string[]>>;
  /** The icon name each entity id shows. */
  readonly assignment: Readonly<Record<string, string>>;
}

/** Looks up the image of the icon an entity shows. */
export interface IconSource {
  /**
   * The CSS value (`url("data:...")`) of the entity's icon.
   *
   * @param entityId an action id, item id or currency id
   * @returns the value for a `background-image`, or `null` when the entity has no icon
   */
  urlFor(entityId: string): string | null;
}

/** The id the interface asks for to show the credits currency (it has no entity in the game configuration). */
export const CREDITS_ICON_ID = 'credits';

/** An {@link IconSource} that has no icons (the default of the UI, so tests and tools need none). */
export const noIcons: IconSource = { urlFor: () => null };

/**
 * Draws one grid as an SVG document. Neighbouring pixels of the same colour in a row are merged into one rectangle, and the SVG
 * uses crisp edges so scaling up keeps the pixels sharp.
 *
 * Called by: {@link createIconSource}.
 *
 * @param rows the grid, one string per row
 * @param palette the colour of each character
 * @param name the icon's name, used only in error messages
 * @returns the SVG text
 * @throws when the grid is not square or uses a character that is not in the palette
 */
export function renderIconSvg(rows: readonly string[], palette: Readonly<Record<string, string>>, name: string): string {
  const size = rows.length;
  const rects: string[] = [];
  rows.forEach((row, y) => {
    if (row.length !== size) throw new Error(`Icon "${name}" row ${y} has ${row.length} columns, expected ${size}`);
    let x = 0;
    while (x < size) {
      const ch = row[x] as string;
      let end = x + 1;
      while (end < size && row[end] === ch) end++;
      if (ch !== '.') {
        const colour = palette[ch];
        if (colour === undefined) throw new Error(`Icon "${name}" uses "${ch}" (row ${y}), which is not in the palette`);
        rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${colour}"/>`);
      }
      x = end;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

/**
 * Builds the icon lookup of an icon set. Every grid is validated and drawn once, up front.
 *
 * Called by: `main.ts`. Calls: {@link renderIconSvg}.
 *
 * @param set the grids, palette and assignment
 * @returns the lookup
 * @throws when a grid is invalid, has the wrong size, or an entity is assigned an icon that does not exist
 */
export function createIconSource(set: IconSet): IconSource {
  const urls = new Map<string, string>();
  for (const [name, rows] of Object.entries(set.grids)) {
    if (rows.length !== set.size) throw new Error(`Icon "${name}" has ${rows.length} rows, expected ${set.size}`);
    urls.set(name, `url("data:image/svg+xml,${encodeURIComponent(renderIconSvg(rows, set.palette, name))}")`);
  }
  const byEntity = new Map<string, string>();
  for (const [entityId, name] of Object.entries(set.assignment)) {
    const url = urls.get(name);
    if (url === undefined) throw new Error(`Entity "${entityId}" is assigned the unknown icon "${name}"`);
    byEntity.set(entityId, url);
  }
  return { urlFor: (entityId) => byEntity.get(entityId) ?? null };
}
