import { redirect } from "next/navigation";

/** The Agile job board is a paid-member benefit; it lives in the member dashboard. */
export default function JobsPage() {
  redirect("/dashboard/jobs");
}
