import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2 } from "lucide-react";
import { ProfileForm } from "./ProfileCompanyForm";

interface ProfileSummary {
  id: string;
  name: string;
  cnpj: string;
  razaoSocial?: string | null;
  endereco?: unknown;
}

interface ProfilesCardProps {
  profiles: ProfileSummary[];
  selectedProfileId?: string;
  canManageProfiles: boolean;
}

export function ProfilesCard({
  profiles,
  selectedProfileId,
  canManageProfiles,
}: ProfilesCardProps) {
  return (
    <div className="md:col-span-4 flex flex-col gap-4">
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresas
          </CardTitle>
          <CardDescription>Selecione para ver os cenários</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-[min(800px,calc(100vh-14rem))]">
            <div className="space-y-2 p-6 pt-0">
              <ProfileForm
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                canManage={canManageProfiles}
              />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

