"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthCard, FormNotice } from "@/components/AuthForm";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <AuthCard title="Forgot password">
      <form action={formAction} className="p-6">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-neutral-600">Enter the email you use for Fairbnb and we&apos;ll send you a link to choose a new password.</p>

        <div className="mt-6">
          <label className="label" htmlFor="email">Email</label>
          <input className="input py-3 text-base" id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <FormNotice state={state} />

        <button className="btn-primary mt-4 w-full py-3.5 text-base" disabled={pending}>
          {pending ? "…" : state?.message ? "Send another link" : "Send reset link"}
        </button>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Remembered it? <Link className="font-semibold text-neutral-900 underline" href="/login">Back to log in</Link>
        </p>
      </form>
    </AuthCard>
  );
}
