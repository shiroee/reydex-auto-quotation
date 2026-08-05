import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

// Reads the session cookie to decide where to land.
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  redirect(session?.user ? "/dashboard" : "/login");
}
