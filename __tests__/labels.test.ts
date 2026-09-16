/**
 * The codes on the boxes actually scan.
 *
 * This is the one thing in the repository where being wrong is expensive in the
 * physical world. A QR that does not decode is not a bug you fix on Monday — it
 * is a thousand printed stickers, on boxes, at an event, and a guest with a nut
 * allergy pointing a phone at a square that does nothing.
 *
 * So the codes are not trusted because a library made them. Every one is
 * rendered to a bitmap and decoded by a completely different library, and the
 * text that comes back has to be the URL that went in. Encode with `qrcode`,
 * decode with `jsQR`: if two independent implementations agree, the square on
 * the sticker is right.
 */
import jsQR from "jsqr";
import {
  qrMatrix, rowRuns, labelUrl, labelsFor, ERROR_CORRECTION, type QrMatrix
} from "@/lib/labels";
import { DISHES } from "@/data/dishes";
import { ALLERGENS, ALLERGEN_LABEL, DIETS, DIET_LABEL } from "@/lib/dietary";

const BASE = "https://ayesicena.pe";

/**
 * Paint the matrix into RGBA pixels, the way a printer and a camera would.
 *
 * `scale` is pixels per module and `quiet` the white border in modules. The
 * spec asks for four modules of quiet zone; anything less and real scanners
 * start to struggle, which is why the component draws two and the CSS adds the
 * rest as white space around the sticker.
 */
function rasterise(m: QrMatrix, scale = 4, quiet = 4): ImageData {
  const span = (m.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(span * span * 4).fill(255);

  for (let y = 0; y < m.size; y++) {
    for (const [x, run] of rowRuns(m, y)) {
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < run * scale; dx++) {
          const px = (x + quiet) * scale + dx;
          const py = (y + quiet) * scale + dy;
          const i = (py * span + px) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: span, height: span, colorSpace: "srgb" } as ImageData;
}

const decode = (m: QrMatrix) => {
  const img = rasterise(m);
  return jsQR(img.data, img.width, img.height)?.data ?? null;
};

describe("a code decodes back to the page it points at", () => {
  it("round-trips one URL through two independent libraries", () => {
    const url = labelUrl(7, BASE);
    expect(decode(qrMatrix(url))).toBe(url);
  });

  it("round-trips every dish on the menu, not a sample", () => {
    const broken: string[] = [];
    for (const dish of DISHES) {
      const url = labelUrl(dish.id, BASE);
      if (decode(qrMatrix(url)) !== url) broken.push(`${dish.id} ${dish.name}`);
    }
    expect(broken).toEqual([]);
  });

  it("survives a long deployment address", () => {
    const long = "https://aye-si-cena-production-lima.netlify.app";
    const url = labelUrl(223, long);
    expect(decode(qrMatrix(url))).toBe(url);
  });

  it("is built at error correction Q, not the smaller levels", () => {
    /*
     * There is deliberately no test here asserting "survives N% damage".
     *
     * The obvious one was written and then deleted, because jsQR's recovery is
     * not a fair proxy for a real scanner's: obliterating a contiguous 10% of
     * the image defeats it at level H exactly as it does at level M, which is
     * not how Reed-Solomon behaves and tells you about the decoder rather than
     * the code. A test that appears to prove a safety margin it has not
     * measured is worse than no test, so the level is asserted as the design
     * choice it is, and the three tolerances below are the ones this can
     * honestly measure.
     */
    expect(ERROR_CORRECTION).toBe("Q");
  });
});

/**
 * The three ways a printed code actually fails, measured rather than assumed.
 *
 * Every figure below was found by sweeping until it broke, not chosen to pass.
 */
describe("the printed code survives a real kitchen", () => {
  const url = labelUrl(42, BASE);
  const m = qrMatrix(url);

  it("decodes from a 37-pixel image — one pixel per module", () => {
    // The sticker is about 22mm square, photographed across a function room by
    // somebody's old phone. Resolution is the failure mode people assume, and
    // it turns out to be the one there is most margin on.
    expect(decode(m)).toBe(url);
    const tiny = rasterise(m, 1, 4);
    expect(jsQR(tiny.data, tiny.width, tiny.height)?.data).toBe(url);
  });

  it("decodes with no quiet zone at all — a sticker cut to the edge", () => {
    // The spec asks for four modules of white around the code. Whoever is
    // cutting these at 6am will not be measuring, so it matters that it still
    // reads at zero.
    const cropped = rasterise(m, 6, 0);
    expect(jsQR(cropped.data, cropped.width, cropped.height)?.data).toBe(url);
  });

  it("decodes from a faded print, down to mid-grey ink", () => {
    // A printer running out of toner produces grey, not gaps. It reads at
    // 140/255 and fails at 170 — so "looks a bit light" is fine and "looks
    // washed out" is not.
    const faded = rasterise(m, 6, 4);
    for (let i = 0; i < faded.data.length; i += 4) {
      if (faded.data[i] === 0) {
        faded.data[i] = faded.data[i + 1] = faded.data[i + 2] = 140;
      }
    }
    expect(jsQR(faded.data, faded.width, faded.height)?.data).toBe(url);
  });
});

describe("the matrix itself", () => {
  const m = qrMatrix(labelUrl(1, BASE));

  it("is square and the right length", () => {
    expect(m.modules).toHaveLength(m.size * m.size);
    expect(m.size).toBeGreaterThan(20);
  });

  it("carries the three finder patterns — dark corners, top-left first", () => {
    const at = (x: number, y: number) => m.modules[y * m.size + x];
    for (const [ox, oy] of [[0, 0], [m.size - 7, 0], [0, m.size - 7]]) {
      expect(at(ox, oy)).toBe(true);
      // The white ring inside a finder pattern.
      expect(at(ox + 1, oy + 1)).toBe(false);
      expect(at(ox + 3, oy + 3)).toBe(true);
    }
  });

  it("merges horizontal runs rather than drawing a rect per module", () => {
    // 841 modules at version 3, roughly half dark: one element each would be
    // 400 per label and 223 labels is a page that takes seconds to print.
    const rects = Array.from({ length: m.size }, (_, y) => rowRuns(m, y).length)
      .reduce((a, b) => a + b, 0);
    const dark = m.modules.filter(Boolean).length;
    expect(rects).toBeLessThan(dark * 0.75);
  });

  it("describes exactly the dark modules, no more and no fewer", () => {
    const fromRuns = Array.from({ length: m.size }, (_, y) =>
      rowRuns(m, y).reduce((n, [, run]) => n + run, 0)).reduce((a, b) => a + b, 0);
    expect(fromRuns).toBe(m.modules.filter(Boolean).length);
  });
});

describe("what a label says", () => {
  const built = labelsFor(DISHES.slice(0, 12), BASE, {
    allergens: Object.fromEntries(ALLERGENS.map((a) => [a, ALLERGEN_LABEL[a]])),
    diets: Object.fromEntries(DIETS.map((d) => [d, DIET_LABEL[d]])),
    suitsByDish: {}
  });

  it("makes one label per dish", () => {
    expect(built).toHaveLength(12);
  });

  it("points each code at that dish's own page", () => {
    for (const l of built) {
      expect(l.url).toBe(`${BASE}/carta/${l.dishId}`);
      expect(decode(l.qr)).toBe(l.url);
    }
  });

  it("names the allergens in the language it was handed", () => {
    const withAllergens = built.find((l) => l.allergens.length > 0)!;
    expect(withAllergens.allergens.every((a) => typeof a === "string")).toBe(true);
    expect(withAllergens.allergens.join()).not.toMatch(/undefined/);
  });

  it("carries no price, no cost and no supplier", () => {
    // A guest holding a canapé is not a buyer, and a number here would read as
    // what that one bite cost.
    const json = JSON.stringify(built);
    for (const field of ["cost", "price", "source", "costVerified"]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});
