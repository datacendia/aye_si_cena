"use server";

import { z } from "zod";
import { requireCan } from "@/lib/session";
import { CAN } from "@/lib/permissions";
import { couldTake } from "@/lib/repo/bookings";
import type { ServiceTier } from "@/lib/dishes";
import type { Clash } from "@/lib/capacity";

export interface Answer {
  ok: boolean | null;
  why?: string;
  clashes: Clash[];
  against: number;
  /** Echoed back so the page can offer to book exactly what was asked about. */
  asked: {
    date: string; serviceMinutes: number; durationMinutes: number;
    guests: number; tier: string; district: string; venue: string;
  };
}

const Ask = z.object({
  date: z.string().min(10),
  time: z.string().min(4),
  hours: z.coerce.number().min(0.5).max(12),
  guests: z.coerce.number().int().min(1).max(500),
  tier: z.string().min(1),
  district: z.string().min(1),
  venue: z.string().min(1),
  planchas: z.coerce.number().int().min(0).max(20),
  fryers: z.coerce.number().int().min(0).max(20),
  ovens: z.coerce.number().int().min(0).max(20),
  vans: z.coerce.number().int().min(0).max(20),
  crew: z.coerce.number().int().min(1).max(60)
});

/**
 * The question a caterer is actually asked, answered against the book.
 *
 * lib/capacity.ts has been able to answer this since it was written; what it
 * never had was anything real to answer it about. The day page compared jobs
 * typed into a form. This reads the Saturday you have already sold.
 */
export async function ask(_prev: Answer | undefined, form: FormData): Promise<Answer | undefined> {
  const me = await requireCan(CAN.seeKitchen, "check whether a day can take another job");
  const parsed = Ask.safeParse(Object.fromEntries(form));
  if (!parsed.success) return undefined;
  const f = parsed.data;

  const [h, m] = f.time.split(":").map(Number);
  const serviceMinutes = h * 60 + (m || 0);
  const durationMinutes = Math.round(f.hours * 60);

  // Local midnight, not UTC. A date picker gives "2026-05-14"; new Date() on
  // that string is UTC midnight, which in Lima is the evening of the 13th — and
  // the whole answer would be about the wrong day.
  const [y, mo, d] = f.date.split("-").map(Number);
  const eventDate = new Date(y, mo - 1, d);

  const result = await couldTake(
    me,
    {
      eventDate, serviceMinutes, durationMinutes,
      guests: f.guests, tier: f.tier as ServiceTier,
      district: f.district, venue: f.venue
    },
    {
      planchas: f.planchas, fryers: f.fryers, ovens: f.ovens,
      vans: f.vans, crew: f.crew, maxShiftMinutes: 12 * 60
    }
  );

  const asked = {
    date: f.date, serviceMinutes, durationMinutes,
    guests: f.guests, tier: f.tier, district: f.district, venue: f.venue
  };

  return result.ok === null
    ? { ok: null, why: result.why, clashes: [], against: 0, asked }
    : { ok: result.ok, clashes: result.clashes, against: result.against, asked };
}
