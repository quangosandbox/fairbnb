import type { Metadata } from "next";
import Link from "next/link";
import { peekAuthToken } from "@/lib/tokens";
import { AuthCard } from "@/components/AuthForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";
// Keep the token in the URL out of Referer headers sent to other sites.
export const metadata: Metadata = { title: "Choose a new password · Fairbnb", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = await peekAuthToken(token, "reset_password");

  if (!valid || !token) {
    return (
      <AuthCard title="Reset password">
        <div className="p-6">
          <h1 className="text-xl font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Password reset links work once and expire after 1 hour. If you asked for more than one, only the newest link works.
          </p>
          <Link href="/forgot-password" className="btn-primary mt-6 w-full py-3.5 text-base">Request a new link</Link>
          <p className="mt-6 text-center text-sm text-neutral-600">
            <Link className="font-semibold text-neutral-900 underline" href="/login">Back to log in</Link>
          </p>
        </div>
      </AuthCard>
    );
  }
  return <ResetPasswordForm token={token} />;
}
