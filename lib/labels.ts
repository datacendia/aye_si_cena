/**
 * A QR code on every box, pointing at what is actually in it.
 *
 * The single thing that closes a food business is an allergy incident, and the
 * weakest link in a catering kitchen is the allergen card: hand-written at
 * 6am by whoever is packing, from memory, in a hurry. 135 of the 223 dishes
 * here carry three or more of the fourteen declarable allergens, so that card
 * is wrong sooner or later.
 *
 * This removes the human from that step. The label carries a code that resolves
 * to a page generated from the recipe by lib/dietary.ts — the same engine that
 * prints the kitchen's own sheets and answers the client-record clash check.
 * The card cannot disagree with the food, because nobody writes it.
 *
 * What the label deliberately does NOT carry: a price, a cost, a supplier, or
 * the recipe. It is a declaration, not a menu and not a kitchen document.
 */
import QRCode from "qrcode";
import type { Dish } from "./dishes";

/**
 * Error correction level Q — 25% of the code can be unreadable and it still
 * scans.
 *
 * L or M would make a smaller code, and a smaller code is the wrong trade here:
 * these are printed on a label that goes on a box that goes in a van, gets
 * condensation on it, gets a thumbprint of aji panca on it, and is then scanned
 * in a badly-lit function room by somebody's three-year-old phone.
 */
export const ERROR_CORRECTION = "Q" as const;

/** Where a scan lands. Public, because a guest holding a box has no account. */
export function labelUrl(dishId: number, base = ""): string {
  return `${base.replace(/\/+$/, "")}/carta/${dishId}`;
}

/**
 * The code as a grid of booleans, one per module.
 *
 * The library will hand back a finished SVG string, and taking it would mean
 * `dangerouslySetInnerHTML` on a page that prints — this repository has held
 * zero of those since it was written and the reason to keep the zero is that
 * the next person to reach for one will not be generating a QR code.
 *
 * The matrix is the honest primitive anyway: the component draws real elements
 * from it, React escapes nothing because there is nothing to escape, and the
 * same numbers can be handed to a test that decodes them.
 */
export interface QrMatrix {
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** Row-major, true where the module is dark. */
  modules: boolean[];
  /** QR version chosen for this payload. Larger means denser. */
  version: number;
}

export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ERROR_CORRECTION });
  return {
    size: qr.modules.size,
    modules: Array.from(qr.modules.data, (bit) => bit === 1),
    version: qr.version
  };
}

/**
 * The runs of dark modules in one row, as [start, length] pairs.
 *
 * Drawn as runs rather than one rect per module because a version-3 code is
 * 841 modules and roughly half are dark — 400-odd elements per label, times 223
 * labels, is a page that takes seconds to print. Merging horizontal runs cuts
 * it by about two thirds and the printed result is identical.
 */
export function rowRuns(m: QrMatrix, row: number): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= m.size; x++) {
    const dark = x < m.size && m.modules[row * m.size + x];
    if (dark && start === -1) start = x;
    else if (!dark && start !== -1) { runs.push([start, x - start]); start = -1; }
  }
  return runs;
}

export interface Label {
  dishId: number;
  name: string;
  /** The declarable allergens, in the reader's language, already resolved. */
  allergens: string[];
  /** Diets the dish suits, in the reader's language. */
  suits: string[];
  url: string;
  qr: QrMatrix;
}

/**
 * Labels for a set of dishes.
 *
 * Generated together so a run sheet can print one sheet per event rather than
 * one label at a time.
 */
export function labelsFor(
  dishes: Dish[],
  base: string,
  labels: {
    allergens: Record<string, string>;
    diets: Record<string, string>;
    suitsByDish: Record<number, string[]>;
  }
): Label[] {
  return dishes.map((d) => ({
      dishId: d.id,
      name: d.name,
      allergens: d.allergens.map((a) => labels.allergens[a] ?? a),
      suits: (labels.suitsByDish[d.id] ?? []).map((s) => labels.diets[s] ?? s),
      url: labelUrl(d.id, base),
      qr: qrMatrix(labelUrl(d.id, base))
  }));
}
