/**
 * Reading a form, where an empty field means "not edited".
 *
 * This lives in lib/ rather than beside the action because a "use server" file
 * cannot be imported by a test without dragging the whole Next server runtime
 * in — and a validation rule that is only checked by a copy of itself in a test
 * file is a rule with two versions waiting to disagree.
 *
 * Both bugs this guards against shipped, and both looked like validation
 * working correctly:
 *
 * `z.coerce.number()` on "" is 0, not a failure, so the `.or(z.literal(""))`
 * that was meant to catch an untouched price never ran. Every dish edit arrived
 * carrying price 0 and the repository refused it with "A menu price has to be
 * more than zero." Renaming a dish became impossible unless you also typed a
 * price, and the error pointed at the one field the person had deliberately
 * left alone.
 *
 * An unticked checkbox sends nothing at all, which is exactly what the form
 * sends for "I did not touch this" — so the licence flag could be switched on
 * and never off. It is read as "true"/"false" strings rather than coerced,
 * because Boolean("false") is true.
 *
 * Neither was visible from reading the code. Both were found by filling the
 * form in a browser.
 */
import { z } from "zod";

/** An empty or absent field is null — "not edited" — rather than a value. */
export const blank = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), inner.nullable());

export const DishForm = z.object({
  name: blank(z.string().max(160)),
  nameEs: blank(z.string().max(160)),
  fusion: blank(z.string().max(1200)),
  fusionEs: blank(z.string().max(1200)),
  price: blank(z.coerce.number().positive()),
  category: blank(z.string().max(40)),
  needsLicence: blank(z.enum(["true", "false"]).transform((v) => v === "true"))
});

export type DishFormValues = z.infer<typeof DishForm>;
