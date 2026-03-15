import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCog, Building2 } from "lucide-react";
import type { UserPermissions } from "@/lib/auth/rbac";
import type { ScenarioWithRelations } from "@/lib/scenarios/types";
import { ScenarioEditor } from "./ScenarioEditor";

interface ScenariosCardProps {
  scenarios: ScenarioWithRelations[];
  selectedProfileId?: string;
  selectedProfileName?: string | null;
  permissions: UserPermissions;
}

export function ScenariosCard({
  scenarios,
  selectedProfileId,
  selectedProfileName,
  permissions,
}: ScenariosCardProps) {
  const { canViewProfiles, canManageScenarios } = permissions;

  const hasSelectedProfile = Boolean(selectedProfileId);
  const hasScenarios = scenarios.length > 0;

  return (
    <div className={permissions.canViewProfiles ? "md:col-span-8" : "md:col-span-12"}>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCog className="h-5 w-5" /> Cenários de Teste
            </CardTitle>
            <CardDescription>
              Gerenciando cenários de:{" "}
              <span className="font-bold text-primary">
                {selectedProfileName || "Selecione..."}
              </span>
            </CardDescription>
          </div>
          {hasSelectedProfile && canManageScenarios && (
            <ScenarioEditor profileId={selectedProfileId!} />
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {!hasSelectedProfile ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Building2 className="h-10 w-10 opacity-20" />
              <p>
                {canViewProfiles
                  ? "Selecione uma empresa ao lado para começar."
                  : "Nenhuma empresa associada."}
              </p>
            </div>
          ) : !hasScenarios ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <FileCog className="h-10 w-10 opacity-20" />
              <p>Nenhum cenário criado para esta empresa.</p>
              {canManageScenarios && (
                <p className="text-xs">Clique em &quot;Novo Cenário&quot; acima.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-foreground">
                        {scenario.name}
                      </h4>
                      <Badge
                        variant={scenario.active ? "default" : "secondary"}
                        className={
                          scenario.active
                            ? "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {scenario.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scenario.reforma_tributaria && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-blue-400/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:border-blue-500/30 dark:bg-blue-500/20"
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

                  {canManageScenarios && hasSelectedProfile && (
                    <div className="flex items-center gap-2">
                      <ScenarioEditor
                        profileId={selectedProfileId!}
                        scenarioToEdit={scenario}
                        isDuplicating
                      />
                      <ScenarioEditor
                        profileId={selectedProfileId!}
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
  );
}

