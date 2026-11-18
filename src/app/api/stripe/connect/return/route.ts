import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/payments";
import { syncAccountStatus } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe sends the host here after onboarding (finished or not). Sync status and go back to /host. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login?next=/host`);
  if (!user.stripeAccountId) return NextResponse.redirect(`${appUrl()}/host`);
  const enabled = await syncAccountStatus(user.stripeAccountId);
  return NextResponse.redirect(`${appUrl()}/host?payouts=${enabled ? "ready" : "incomplete"}`);
}
