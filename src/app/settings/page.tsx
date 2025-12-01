import { db } from "@/app/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioEditor } from "@/components/settings/scenario-editor";
import { ProfileForm } from "@/components/settings/profile-company-form";
import { Building2, FileCog, Shield, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helper";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Definimos o tipo como uma Promise (Next.js 15+)
type SearchParams = Promise<{ profileId?: string }>;

export default async function SettingsPage(props: {
  searchParams: SearchParams;
}) {
  // 1. Aguardamos a resolução dos parâmetros
  const searchParams = await props.searchParams;

  // 2. Obter usuário atual e verificar permissões
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // TODO: Redirecionar para login quando autenticação estiver implementada
    redirect("/");
  }

  const { permissions, role, profileId: userProfileId } = currentUser;

  // 3. Busca profiles baseado nas permissões
  let profiles;
  if (permissions.canViewProfiles) {
    // Admin vê todos os profiles
    profiles = await db.profile.findMany();
  } else {
    // Member vê apenas seu profile
    if (!userProfileId) {
      return (
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Shield className="h-5 w-5" /> Acesso Negado
              </CardTitle>
              <CardDescription>
                Você não possui um perfil de empresa associado. Entre em contato
                com o administrador.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    const userProfile = await db.profile.findUnique({
      where: { id: userProfileId },
    });

    profiles = userProfile ? [userProfile] : [];
  }

  // 4. Define o profile selecionado
  let selectedProfileId = searchParams.profileId || profiles[0]?.id;

  // 5. Verifica se o membro tem acesso ao profile selecionado
  if (role === "member" && selectedProfileId !== userProfileId) {
    selectedProfileId = userProfileId!;
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  // 6. Busca cenários do profile selecionado
  const scenarios = selectedProfileId
    ? await db.scenario.findMany({
        where: { profileId: selectedProfileId },
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
    <div className="container mx-auto py-8 h-[calc(100vh-4rem)]">
      {/* Header com Badge e Botão de Gerenciar Usuários */}
      <div className="mb-4 flex justify-between items-center">
        <div>
          {role === "admin" && (
            <Button variant="outline" asChild>
              <Link href="/configuracoes/users">
                <Users className="h-4 w-4 mr-2" />
                Gerenciar Usuários
              </Link>
            </Button>
          )}
        </div>
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          <Shield className="h-3 w-3 mr-1" />
          {role === "admin" ? "Administrador" : "Usuário"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
        {/* --- COLUNA ESQUERDA: LISTA DE EMPRESAS (apenas para admin) --- */}
        {permissions.canViewProfiles && (
          <div className="md:col-span-4 flex flex-col gap-4">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Empresas
                </CardTitle>
                <CardDescription>
                  Selecione para ver os cenários
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-2">
                <ProfileForm
                  profiles={profiles}
                  selectedProfileId={selectedProfileId}
                  canManage={permissions.canManageProfiles}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- COLUNA DIREITA: CENÁRIOS --- */}
        <div
          className={
            permissions.canViewProfiles ? "md:col-span-8" : "md:col-span-12"
          }
        >
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCog className="h-5 w-5" /> Cenários de Teste
                </CardTitle>
                <CardDescription>
                  Gerenciando cenários de:{" "}
                  <span className="font-bold text-primary">
                    {selectedProfile?.name || "Selecione..."}
                  </span>
                </CardDescription>
              </div>
              {selectedProfileId && permissions.canManageScenarios && (
                <ScenarioEditor profileId={selectedProfileId} />
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
              {!selectedProfileId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <Building2 className="h-10 w-10 opacity-20" />
                  <p>
                    {permissions.canViewProfiles
                      ? "Selecione uma empresa ao lado para começar."
                      : "Nenhuma empresa associada."}
                  </p>
                </div>
              ) : scenarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <FileCog className="h-10 w-10 opacity-20" />
                  <p>Nenhum cenário criado para esta empresa.</p>
                  {permissions.canManageScenarios && (
                    <p className="text-xs">
                      Clique em &quot;Novo Cenário&quot; acima.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="bg-white border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">
                            {scenario.name}
                          </h4>
                          <Badge
                            variant={scenario.active ? "default" : "secondary"}
                            className={
                              scenario.active
                                ? "bg-green-600 hover:bg-green-700"
                                : ""
                            }
                          >
                            {scenario.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {scenario.reforma_tributaria && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-blue-200 bg-blue-50 text-blue-700"
                            >
                              Reforma Trib.
                            </Badge>
                          )}
                          {scenario.editar_data && (
                            <Badge variant="outline" className="text-[10px]">
                              Data
                            </Badge>
                          )}
                          {scenario.editar_emitente && (
                            <Badge variant="outline" className="text-[10px]">
                              Emitente
                            </Badge>
                          )}
                          {scenario.alterar_cUF && (
                            <Badge variant="outline" className="text-[10px]">
                              UF
                            </Badge>
                          )}
                          {scenario.alterar_serie && (
                            <Badge variant="outline" className="text-[10px]">
                              Série
                            </Badge>
                          )}
                          {scenario.aplicar_reducao_aliq && (
                            <Badge variant="outline" className="text-[10px]">
                              Redução Alíquota
                            </Badge>
                          )}
                          {scenario.editar_destinatario_pj && (
                            <Badge variant="outline" className="text-[10px]">
                              Dest. PJ
                            </Badge>
                          )}
                          {scenario.editar_destinatario_pf && (
                            <Badge variant="outline" className="text-[10px]">
                              Dest. PF
                            </Badge>
                          )}
                          {scenario.editar_produtos && (
                            <Badge variant="outline" className="text-[10px]">
                              Produtos
                            </Badge>
                          )}
                          {scenario.editar_impostos && (
                            <Badge variant="outline" className="text-[10px]">
                              Impostos
                            </Badge>
                          )}
                          {scenario.editar_refNFe && (
                            <Badge variant="outline" className="text-[10px]">
                              Ref. NFe
                            </Badge>
                          )}
                          {scenario.editar_cst && (
                            <Badge variant="outline" className="text-[10px]">
                              CST
                            </Badge>
                          )}
                          {scenario.zerar_ipi_remessa_retorno && (
                            <Badge variant="outline" className="text-[10px]">
                              Zerar IPI Remessa/Retorno
                            </Badge>
                          )}
                          {scenario.zerar_ipi_venda && (
                            <Badge variant="outline" className="text-[10px]">
                              Zerar IPI Venda
                            </Badge>
                          )}
                        </div>
                      </div>

                      {permissions.canManageScenarios && (
                        <div className="flex items-center gap-2">
                          {/* Botão Duplicar */}
                          <ScenarioEditor
                            profileId={selectedProfileId}
                            scenarioToEdit={scenario}
                            isDuplicating={true}
                          />
                          {/* Botão Editar */}
                          <ScenarioEditor
                            profileId={selectedProfileId}
                            scenarioToEdit={scenario}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
