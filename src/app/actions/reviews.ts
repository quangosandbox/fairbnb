"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { todayUTC } from "@/lib/listings";

export async function leaveReview(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bookingId = String(form.get("bookingId"));
  const rating = Math.floor(Number(form.get("rating")));
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { review: true } });
  if (!b || b.guestId !== user.id || b.review) return;
  if (!(b.status === "COMPLETED" || (b.status === "CONFIRMED" && b.checkOut <= todayUTC()))) return;
  if (!(rating >= 1 && rating <= 5) || body.length < 10) return;
  await db.review.create({ data: { bookingId, listingId: b.listingId, authorId: user.id, rating, body } });
  redirect(`/listings/${b.listingId}`);
}
