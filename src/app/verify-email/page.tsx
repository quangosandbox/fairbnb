import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { consumeAuthToken } from "@/lib/tokens";
import { AuthCard } from "@/components/AuthForm";
import { Icon } from "@/components/Icons";
import { ResendVerificationButton } from "./client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm your email · Fairbnb", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (token) {
    const owner = await consumeAuthToken(token, "verify_email");
    if (owner) {
      const user = await db.user.findUnique({ where: { id: owner.userId }, select: { email: true, emailVerifiedAt: true } });
      if (user && !user.emailVerifiedAt) {
        await db.user.update({ where: { id: owner.userId }, data: { emailVerifiedAt: new Date() } });
      }
      return (
        <AuthCard title="Confirm email">
          <div className="p-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Icon name="check" className="h-6 w-6 text-brand-600" strokeWidth={3} />
            </span>
            <h1 className="mt-4 text-xl font-semibold">Email confirmed</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Thanks! <span className="font-semibold text-neutral-900">{user?.email}</span> is confirmed. You&apos;re all set to book stays.
            </p>
            <Link href="/" className="btn-primary mt-6 w-full py-3.5 text-base">Start exploring</Link>
          </div>
        </AuthCard>
      );
    }
  }

  const user = await getCurrentUser();
  if (user?.emailVerifiedAt) {
    return (
      <AuthCard title="Confirm email">
        <div className="p-6 text-center">
          <h1 className="text-xl font-semibold">Your email is already confirmed</h1>
          <p className="mt-2 text-sm text-neutral-600">{user.email} is confirmed. Nothing else to do.</p>
          <Link href="/" className="btn-primary mt-6 w-full py-3.5 text-base">Start exploring</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm email">
      <div className="p-6">
        <h1 className="text-xl font-semibold">{token ? "This link has expired" : "Confirm your email"}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {token
            ? "Confirmation links work once and expire after 48 hours. "
            : "We emailed you a link to confirm your address. "}
          {user ? (
            <>We can send a new one to <span className="font-semibold text-neutral-900">{user.email}</span>.</>
          ) : (
            "Log in and we'll send you a new one."
          )}
        </p>
        <div className="mt-6">
          {user ? (
            <ResendVerificationButton />
          ) : (
            <Link href="/login?next=/verify-email" className="btn-primary w-full py-3.5 text-base">Log in to get a new link</Link>
          )}
        </div>
      </div>
    </AuthCard>
  );
}
