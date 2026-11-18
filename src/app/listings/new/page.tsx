import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ListingForm } from "@/components/ListingForm";

export default async function NewListingPage() {
  if (!(await getCurrentUser())) redirect("/login?next=/listings/new");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">List your place</h1>
      <p className="mt-1 text-neutral-600">Free to list. No commission. You keep 100% of what you charge.</p>
      <div className="mt-6"><ListingForm /></div>
    </div>
  );
}
