import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { ScenarioWithRelations } from "@/lib/scenarios/types";
import type { UserPermissions } from "@/lib/auth/rbac";
import { SettingsHeader } from "./_components/SettingsHeader";
import { ProfilesCard } from "./_components/ProfilesCard";
import { ScenariosCard } from "./_components/ScenariosCard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileCog } from "lucide-react";

export const dynamic = "force-dynamic";

// Definimos o tipo como uma Promise (Next.js 15+)
type SearchParams = Promise<{ profileId?: string }>;

interface SettingsPageProps {
  searchParams: SearchParams;
}

async function ScenariosSection({
  profileId,
  profileName,
  permissions,
}: {
  profileId: string | undefined;
  profileName: string | null | undefined;
  permissions: UserPermissions;
}) {
  const scenarios: ScenarioWithRelations[] = profileId
    ? await db.scenario.findMany({
        where: { profileId, deletedAt: null },
        orderBy: { name: "asc" },
        include: {
          ScenarioEmitente: true,
          ScenarioDestinatario: true,
          ScenarioProduto: true,
          ScenarioImposto: true,
          CstMapping: true,
          TaxReformRule: true,
        },
      })
    : [];

  return (
    <ScenariosCard
      scenarios={scenarios}
      selectedProfileId={profileId}
      selectedProfileName={profileName}
      permissions={permissions}
    />
  );
}

function ScenariosSkeleton({
  colSpan = "md:col-span-8",
}: {
  colSpan?: string;
}) {
  return (
    <div className={`${colSpan} flex flex-col`}>
      <Card className="h-full flex flex-col animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent className="flex-1 bg-muted/30 p-6">
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
            <FileCog className="h-12 w-12 text-muted-foreground/30" />
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-36 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function SettingsPage(
  props: SettingsPageProps,
): Promise<React.ReactElement> {
  const [searchParams, currentUser] = await Promise.all([
    props.searchParams,
    getCurrentUser(),
  ]);

  if (!currentUser) {
    redirect("/");
  }

  const { permissions, role, profileId: userProfileId } = currentUser;

  let profiles;
  if (permissions.canViewProfiles) {
    profiles = await db.profile.findMany({
      where: { deletedAt: null },
    });
  } else {
    if (!userProfileId) {
      return (
        <div className="container mx-auto py-8">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
            <h1 className="text-lg font-semibold text-destructive flex items-center gap-2">
              Acesso Negado
            </h1>
            <p className="text-sm text-destructive/90 mt-2">
              Você não possui um perfil de empresa associado. Entre em contato com o
              administrador.
            </p>
          </div>
        </div>
      );
    }

    const userProfile = await db.profile.findUnique({
      where: {
        id: userProfileId,
        deletedAt: null,
      },
    });

    profiles = userProfile ? [userProfile] : [];
  }

  let selectedProfileId = searchParams.profileId || profiles[0]?.id;

  if (role === "member" && selectedProfileId !== userProfileId) {
    selectedProfileId = userProfileId!;
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="container mx-auto py-8 h-[calc(100vh-4rem)]">
      <SettingsHeader role={role} />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
        {permissions.canViewProfiles && (
          <ProfilesCard
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            canManageProfiles={permissions.canManageProfiles}
          />
        )}

        <Suspense key={selectedProfileId ?? "none"} fallback={<ScenariosSkeleton />}>
          <ScenariosSection
            profileId={selectedProfileId}
            profileName={selectedProfile?.name}
            permissions={permissions as UserPermissions}
          />
        </Suspense>
      </div>
    </div>
  );
}
