"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hostPayoutsLink } from "@/lib/payments";

export type ListingFormState = { error?: string } | undefined;

const dollarsToCents = (v: unknown) => Math.round(Number(v) * 100);

const schema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(5000),
  propertyType: z.string().trim().min(2).max(40),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().max(80),
  country: z.string().trim().min(2).max(80),
  maxGuests: z.coerce.number().int().min(1).max(50),
  bedrooms: z.coerce.number().int().min(0).max(50),
  beds: z.coerce.number().int().min(1).max(100),
  bathrooms: z.coerce.number().min(0).max(50),
  nightlyPriceCents: z.preprocess(dollarsToCents, z.number().int().min(100, "Nightly price must be at least $1").max(10_000_000)),
  cleaningFeeCents: z.preprocess(dollarsToCents, z.number().int().min(0).max(1_000_000)),
  taxRateBps: z.preprocess((v) => Math.round(Number(v) * 100), z.number().int().min(0).max(3000, "Tax rate must be 30% or less")),
  minNights: z.coerce.number().int().min(1).max(90),
  amenities: z.string().max(2000),
  photoUrls: z.string().max(5000),
});

export async function createListing(_: ListingFormState, form: FormData): Promise<ListingFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/listings/new");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${i.path.join(".")}: ${i.message}` };
  }
  const { amenities, photoUrls, ...data } = parsed.data;
  const urls = photoUrls.split(/\s+/).map((s) => s.trim()).filter((s) => /^https:\/\/\S+$/.test(s)).slice(0, 20);
  if (urls.length === 0) return { error: "Add at least one photo URL (https://…)" };
  const listing = await db.listing.create({
    data: {
      ...data,
      hostId: user.id,
      amenities: amenities.split(",").map((a) => a.trim()).filter(Boolean).slice(0, 50),
      photos: { create: urls.map((url, position) => ({ url, position })) },
    },
  });
  redirect(`/listings/${listing.id}`);
}

export async function togglePublished(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(form.get("listingId"));
  const l = await db.listing.findUnique({ where: { id } });
  if (!l || l.hostId !== user.id) return;
  await db.listing.update({ where: { id }, data: { published: !l.published } });
  redirect("/host");
}

export async function setUpPayouts() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host");
  redirect(await hostPayoutsLink(user.id));
}
