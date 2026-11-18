import { FLASH_COOKIE_NAME, getCurrentUser, isEmailVerified, readFlash } from "@/lib/auth";
import { ClearFlashCookie, ResendVerificationButton } from "@/app/verify-email/client";
import { Icon } from "./Icons";

/**
 * Slim notices under the header (server component, meant for the root layout):
 *  - a one-shot "flash" message after a redirect (e.g. password changed), and
 *  - for a logged-in user whose email isn't confirmed yet, a reminder with a resend link.
 */
export async function VerifyEmailBanner() {
  const [user, flash] = await Promise.all([getCurrentUser(), readFlash()]);
  const unverified = user && !isEmailVerified(user);
  if (!flash && !unverified) return null;
  return (
    <>
      {flash && (
        <div role="status" className="border-b border-brand-100 bg-brand-50 text-sm text-brand-900">
          <p className="mx-auto flex max-w-[1760px] items-center gap-2 px-6 py-2.5 lg:px-10">
            <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={3} /> {flash}
          </p>
          <ClearFlashCookie name={FLASH_COOKIE_NAME} />
        </div>
      )}
      {unverified && (
        <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
          <div className="mx-auto max-w-[1760px] px-6 py-2.5 lg:px-10">
            Confirm your email to book stays. Check <span className="font-semibold">{user.email}</span> or{" "}
            <ResendVerificationButton variant="link" />.
          </div>
        </div>
      )}
    </>
  );
}
