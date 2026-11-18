"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with that email already exists" };
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Wrong email or password" };
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
