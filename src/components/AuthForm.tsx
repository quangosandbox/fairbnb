"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions/auth";

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "login" | "signup";
  action: (s: FormState, f: FormData) => Promise<FormState>;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mx-auto mt-16 max-w-sm space-y-4 px-4">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <input type="hidden" name="next" value={next ?? "/"} />
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" minLength={mode === "signup" ? 8 : undefined} required />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "…" : mode === "login" ? "Log in" : "Sign up"}
      </button>
      <p className="text-center text-sm text-neutral-600">
        {mode === "login" ? (
          <>New here? <Link className="text-brand-700 underline" href={`/signup?next=${encodeURIComponent(next ?? "/")}`}>Sign up</Link></>
        ) : (
          <>Have an account? <Link className="text-brand-700 underline" href={`/login?next=${encodeURIComponent(next ?? "/")}`}>Log in</Link></>
        )}
      </p>
    </form>
  );
}
