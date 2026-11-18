import "server-only";
// Implemented by the payments workstream: startStripeCheckout, createOnboardingLink, startStripeDonation.
export async function startStripeCheckout(_bookingId: string): Promise<string> {
  throw new Error("Stripe checkout not implemented yet");
}
export async function createOnboardingLink(_userId: string): Promise<string> {
  throw new Error("Stripe onboarding not implemented yet");
}
export async function startStripeDonation(_amountCents: number, _userId: string | null): Promise<string> {
  throw new Error("Stripe donations not implemented yet");
}
