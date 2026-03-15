import { redirect } from "next/navigation";
import { isAuthenticated } from "./actions/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authenticated = await isAuthenticated();
  if (authenticated) {
    redirect("/xml-manipulator");
  }
  redirect("/login");
}
