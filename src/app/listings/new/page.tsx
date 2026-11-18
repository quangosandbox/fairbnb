import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ListingForm } from "@/components/ListingForm";

export const metadata = { title: "Create your listing — Fairbnb" };

export default async function NewListingPage() {
  if (!(await getCurrentUser())) redirect("/login?next=/listings/new");
  return <ListingForm />;
}
