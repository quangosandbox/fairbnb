import { NextResponse } from "next/server";
import { constructWebhookEvent, handleStripeEvent } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receives both platform events and Connect (connected-account) events.
 * Signature is checked against the RAW body, so read it with req.text().
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  const rawBody = await req.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // 500 makes Stripe retry with backoff; handlers are idempotent.
    console.error(`[stripe webhook] failed handling ${event.type} ${event.id}`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
