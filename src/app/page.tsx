import { redirect } from "next/navigation";
import { isAuthenticated } from "./actions/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  console.log("[HOME] Acessando página raiz");
  const authenticated = await isAuthenticated();

  console.log("[HOME] Autenticado:", authenticated);
  if (authenticated) {
    console.log("[HOME] Redirecionando para /manipulador");
    redirect("/manipulador");
  } else {
    console.log("[HOME] Redirecionando para /login");
    redirect("/login");
  }
}
