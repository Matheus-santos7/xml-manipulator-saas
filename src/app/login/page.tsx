import { redirect } from "next/navigation";
import { isAuthenticated } from "@/app/actions/auth";
import { LoginForm } from "./_components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Se já está autenticado, redireciona
  const authenticated = await isAuthenticated();
  if (authenticated) {
    redirect("/xml-manipulator");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-muted/60 via-background to-background">
      <LoginForm />
    </div>
  );
}
