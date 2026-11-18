"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { startDonation } from "@/lib/payments";

export async function donate(form: FormData) {
  const dollars = Number(form.get("amount"));
  const cents = Math.round(dollars * 100);
  if (!(cents >= 100 && cents <= 1_000_000)) redirect("/donate?error=1");
  const user = await getCurrentUser();
  redirect(await startDonation(cents, user?.id ?? null));
}
