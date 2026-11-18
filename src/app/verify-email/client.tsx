"use client";

import { useActionState, useEffect } from "react";
import { resendVerification } from "@/app/actions/auth";

/** Resend-the-confirmation-email control. `variant="link"` fits inline in the banner. */
export function ResendVerificationButton({ variant = "button" }: { variant?: "button" | "link" }) {
  const [state, formAction, pending] = useActionState(resendVerification, undefined);
  const feedback = state?.error ?? state?.message;
  if (variant === "link") {
    return (
      <form action={formAction} className="inline">
        {feedback ? (
          <span role="status" className={state?.error ? "text-red-700" : "font-semibold"}>{feedback}</span>
        ) : (
          <button className="font-semibold underline disabled:opacity-50" disabled={pending}>{pending ? "Sending…" : "resend"}</button>
        )}
      </form>
    );
  }
  return (
    <form action={formAction}>
      <button className="btn-primary w-full py-3.5 text-base" disabled={pending}>{pending ? "…" : "Send a new link"}</button>
      {feedback && (
        <p role="status" className={`mt-3 text-sm ${state?.error ? "text-red-600" : "text-brand-700"}`}>{feedback}</p>
      )}
    </form>
  );
}

/** Flash notices are one-shot: drop the cookie once it has been rendered. */
export function ClearFlashCookie({ name }: { name: string }) {
  useEffect(() => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  }, [name]);
  return null;
}
