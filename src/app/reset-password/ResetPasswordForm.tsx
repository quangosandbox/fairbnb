"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { AuthCard, FormNotice } from "@/components/AuthForm";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, undefined);
  return (
    <AuthCard title="Reset password">
      <form action={formAction} className="p-6">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-neutral-600">You&apos;ll be logged in, and signed out everywhere else.</p>
        <input type="hidden" name="token" value={token} />

        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input className="input py-3 text-base" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <input className="input py-3 text-base" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Password must be at least 8 characters.</p>

        <FormNotice state={state} />
        {state?.error?.includes("expired") && (
          <p className="mt-2 text-sm">
            <Link className="font-semibold text-neutral-900 underline" href="/forgot-password">Request a new link</Link>
          </p>
        )}

        <button className="btn-primary mt-4 w-full py-3.5 text-base" disabled={pending}>
          {pending ? "…" : "Save password"}
        </button>
      </form>
    </AuthCard>
  );
}
