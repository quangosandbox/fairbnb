"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions/auth";
import { Icon } from "./Icons";

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
  const nextQ = encodeURIComponent(next ?? "/");
  // Joined input group: each field is a cell inside one rounded border, separated by hairlines.
  const cell = "block px-4 py-2.5 focus-within:relative focus-within:z-10 focus-within:rounded-lg focus-within:ring-2 focus-within:ring-neutral-900";
  const inputCls = "w-full bg-transparent text-base outline-none placeholder:text-neutral-400";

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] items-start justify-center bg-neutral-50 px-4 py-8 sm:items-center sm:py-12">
      <div className="w-full max-w-[568px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
        <div className="relative flex h-16 items-center justify-center border-b border-neutral-200 px-6">
          <Link href="/" aria-label="Close" className="absolute left-4 rounded-full p-2 hover:bg-neutral-100">
            <Icon name="close" className="h-4 w-4" />
          </Link>
          <p className="font-semibold">{mode === "login" ? "Log in or sign up" : "Finish signing up"}</p>
        </div>

        <form action={formAction} className="p-6">
          <h1 className="text-xl font-semibold">Welcome to Fairbnb</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {mode === "login" ? "Log in to book stays, save favorites and manage your listings." : "Create an account. It's free, and so is every booking."}
          </p>
          <input type="hidden" name="next" value={next ?? "/"} />

          <div className="mt-6 overflow-hidden rounded-lg border border-neutral-400">
            {mode === "signup" && (
              <label className={`${cell} border-b border-neutral-400`}>
                <span className="block text-xs text-neutral-600">Name</span>
                <input className={inputCls} id="name" name="name" autoComplete="name" required />
              </label>
            )}
            <label className={`${cell} border-b border-neutral-400`}>
              <span className="block text-xs text-neutral-600">Email</span>
              <input className={inputCls} id="email" name="email" type="email" autoComplete="email" required />
            </label>
            <label className={cell}>
              <span className="block text-xs text-neutral-600">Password</span>
              <input
                className={inputCls}
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </label>
          </div>
          {mode === "signup" && <p className="mt-2 text-xs text-neutral-500">Password must be at least 8 characters.</p>}

          {state?.error && (
            <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <Icon name="close" className="h-4 w-4 shrink-0" /> {state.error}
            </p>
          )}

          <button className="btn-primary mt-4 w-full py-3.5 text-base" disabled={pending}>
            {pending ? "…" : "Continue"}
          </button>

          <div className="my-6 flex items-center gap-4 text-xs text-neutral-500">
            <span className="h-px flex-1 bg-neutral-200" /> or <span className="h-px flex-1 bg-neutral-200" />
          </div>

          <p className="text-center text-sm text-neutral-600">
            {mode === "login" ? (
              <>New to Fairbnb? <Link className="font-semibold text-neutral-900 underline" href={`/signup?next=${nextQ}`}>Sign up</Link></>
            ) : (
              <>Already have an account? <Link className="font-semibold text-neutral-900 underline" href={`/login?next=${nextQ}`}>Log in</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
