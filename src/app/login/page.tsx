import { redirect } from "next/navigation";
import { isAuthenticated } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  // Se já está autenticado, redireciona
  const authenticated = await isAuthenticated();
  if (authenticated) {
    redirect("/manipulador");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <LoginForm />
    </div>
  );
}
