/**
 * An empty form field means "not edited", and saying so is harder than it looks.
 *
 * Both bugs below shipped, and both looked like validation working correctly.
 *
 * `z.coerce.number()` on "" is 0 rather than a failure, so the
 * `.or(z.literal(""))` meant to catch an untouched price never ran. Every dish
 * edit arrived carrying price 0, and the repository refused it with "A menu
 * price has to be more than zero." The effect: renaming a dish was impossible
 * unless you also typed a price, and the error message pointed at a field the
 * person had deliberately left alone.
 *
 * An unticked checkbox sends nothing at all, which is the same thing the form
 * sends for "I did not touch this" — so the licence flag could be switched on
 * and never off again.
 *
 * Neither was visible from reading the code. Both were found by filling the
 * form in a browser. The schema is imported rather than copied — a rule checked
 * by a duplicate of itself has two versions waiting to disagree.
 */
import { DishForm } from "@/lib/forms";

/** What a browser actually sends for that form. */
const posted = (over: Record<string, string> = {}) => ({
  name: "", nameEs: "", fusion: "", fusionEs: "",
  price: "", category: "", needsLicence: "false", ...over
});

describe("an untouched field is null, not a value", () => {
  it("reads an empty price as null rather than as zero", () => {
    const out = DishForm.parse(posted());
    expect(out.price).toBeNull();
    // Zero is what the old version produced, and it is what made the repository
    // refuse every edit that did not also set a price.
    expect(out.price).not.toBe(0);
  });

  it("lets a dish be renamed without touching the price", () => {
    const out = DishForm.parse(posted({ name: "Haggis Bon Bon", nameEs: "Bombón de Haggis" }));
    expect(out).toMatchObject({
      name: "Haggis Bon Bon", nameEs: "Bombón de Haggis", price: null
    });
  });

  it("reads every other empty field as null too", () => {
    const out = DishForm.parse(posted());
    expect(out.name).toBeNull();
    expect(out.fusion).toBeNull();
    expect(out.category).toBeNull();
  });

  it("still takes a real price", () => {
    expect(DishForm.parse(posted({ price: "44.5" })).price).toBe(44.5);
  });

  it("refuses a price of zero or below rather than storing it", () => {
    expect(DishForm.safeParse(posted({ price: "0" })).success).toBe(false);
    expect(DishForm.safeParse(posted({ price: "-3" })).success).toBe(false);
  });

  it("refuses a price that is not a number", () => {
    expect(DishForm.safeParse(posted({ price: "cuarenta" })).success).toBe(false);
  });
});

describe("the licence checkbox can be turned off", () => {
  it("reads a ticked box as true", () => {
    // Both fields are posted when ticked; the checkbox comes last and wins.
    expect(DishForm.parse(posted({ needsLicence: "true" })).needsLicence).toBe(true);
  });

  it("reads an unticked box as false, not as 'leave it alone'", () => {
    // Boolean("false") is true, which is why this is an enum and not a coerce.
    expect(DishForm.parse(posted({ needsLicence: "false" })).needsLicence).toBe(false);
  });

  it("reads a missing field as null — a form that never carried it at all", () => {
    const { needsLicence, ...rest } = posted();
    expect(DishForm.parse(rest).needsLicence).toBeNull();
    expect(needsLicence).toBe("false");
  });
});

describe("the form in app/admin sends what this expects", () => {
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "app", "admin", "dish-editor.tsx"), "utf8"
  );

  it("posts a hidden false before the licence checkbox", () => {
    expect(src).toMatch(/type="hidden"\s+name="needsLicence"\s+value="false"/);
    const hidden = src.indexOf('name="needsLicence" value="false"');
    const box = src.indexOf('type="checkbox"');
    // Order matters: the later value wins, so the checkbox must come second.
    expect(hidden).toBeLessThan(box);
  });

  it("names every field the schema reads", () => {
    for (const field of Object.keys(DishForm.shape)) {
      expect(src).toMatch(new RegExp(`name="${field}"`));
    }
  });
});
