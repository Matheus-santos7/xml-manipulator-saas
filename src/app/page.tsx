import { redirect } from "next/navigation";
import { isAuthenticated } from "./actions/auth";

export default async function Home() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/manipulador");
  } else {
    redirect("/login");
  }
}
