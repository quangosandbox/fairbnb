"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Toggles a listing in the user's wishlist. Returns the new saved state, or null if logged out. */
export async function toggleFavorite(listingId: string): Promise<boolean | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const key = { userId_listingId: { userId: user.id, listingId } };
  const existing = await db.favorite.findUnique({ where: key });
  if (existing) {
    await db.favorite.delete({ where: key });
  } else {
    if (!(await db.listing.findUnique({ where: { id: listingId }, select: { id: true } }))) return false;
    await db.favorite.create({ data: { userId: user.id, listingId } });
  }
  revalidatePath("/wishlists");
  return !existing;
}

export async function getFavoriteIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const favs = await db.favorite.findMany({ where: { userId }, select: { listingId: true } });
  return new Set(favs.map((f) => f.listingId));
}
