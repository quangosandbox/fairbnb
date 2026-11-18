import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/payments";
import { createAccountLink, syncAccountStatus } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe sends the host here when an Account Link expired or was reused. Issue a fresh one. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login?next=/host`);
  if (!user.stripeAccountId) return NextResponse.redirect(`${appUrl()}/host`);
  if (await syncAccountStatus(user.stripeAccountId)) {
    return NextResponse.redirect(`${appUrl()}/host?payouts=ready`);
  }
  return NextResponse.redirect(await createAccountLink(user.stripeAccountId));
}
