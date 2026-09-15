"use server";

import { z } from "zod";
import { requireCan } from "@/lib/session";
import { CAN } from "@/lib/permissions";
import { menu } from "@/lib/repo/menu";
import { getClient } from "@/lib/repo/clients";
import { propose, type Proposal } from "@/lib/propose";
import { RECIPES } from "@/data/recipes";
import { VEDAS } from "@/data/vedas";
import { INGREDIENTS } from "@/data/ingredients";
import { DIETS, type Diet } from "@/lib/dietary";

export interface ProposeResult {
  proposal: Proposal;
  clientName: string | null;
  diets: string[];
  month: number;
}

const Form = z.object({
  month: z.coerce.number().int().min(1).max(12),
  want: z.coerce.number().int().min(1).max(40),
  clientId: z.string().optional()
});

/**
 * Ask all six questions at once.
 *
 * The diets are read from the client record rather than from the form, because
 * an allergy is a fact about the people eating and not a box somebody
 * remembered to tick. That is the whole reason clients.diets exists.
 */
export async function askForMenu(
  _prev: ProposeResult | undefined, form: FormData
): Promise<ProposeResult | undefined> {
  const me = await requireCan(CAN.writeQuotes, "propose a menu");
  const parsed = Form.safeParse(Object.fromEntries(form));
  if (!parsed.success) return undefined;
  const f = parsed.data;

  /*
   * getAll, not Object.fromEntries.
   *
   * The kit is a row of checkboxes that all share the name "equipment", so the
   * form carries one entry per box ticked — and Object.fromEntries keeps only
   * the last of any repeated key. Five ticked boxes arrived as "oven", the
   * proposer filtered the menu down to dishes that need nothing but an oven,
   * and it returned four dishes out of eight while looking entirely correct.
   * Found by driving the page rather than by reading it.
   */
  const equipment = form.getAll("equipment").map(String).filter(Boolean);

  const client = f.clientId ? await getClient(me, f.clientId) : null;
  const diets = (client?.diets ?? []).filter((d): d is Diet =>
    (DIETS as readonly string[]).includes(d));

  return {
    proposal: propose({
      dishes: await menu(me.locale),
      recipes: RECIPES,
      vedas: VEDAS,
      ingredients: INGREDIENTS,
      month: f.month,
      diets,
      want: f.want,
      equipment: equipment.length > 0 ? equipment : undefined
    }),
    clientName: client?.name ?? null,
    diets,
    month: f.month
  };
}
