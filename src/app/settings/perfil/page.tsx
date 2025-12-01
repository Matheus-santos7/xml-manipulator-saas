import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helper";
import { getUserProfile } from "@/app/actions/profile";
import { ProfileEditForm } from "@/components/settings/profile-user-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function PerfilPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const userProfile = await getUserProfile();

  if (!userProfile) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/configuracoes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e credenciais
          </p>
        </div>
      </div>

      <ProfileEditForm user={userProfile} />
    </div>
  );
}
