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
  taxRuleNames?: string[];
}

export function ScenariosCard({
  scenarios,
  selectedProfileId,
  selectedProfileName,
  permissions,
  taxRuleNames = [],
}: ScenariosCardProps) {
  const { canViewProfiles, canManageScenarios } = permissions;

  const hasSelectedProfile = Boolean(selectedProfileId);
  const hasScenarios = scenarios.length > 0;

  return (
    <div className="flex-1 flex flex-col">
      <Card className="h-full flex flex-col">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <FileCog className="h-5 w-5" /> Cenários de Teste
              </CardTitle>
              <CardDescription>Empresa selecionada</CardDescription>
              <p
                className="mt-1 text-sm font-medium text-primary/90 truncate"
                title={selectedProfileName || "Selecione uma empresa"}
              >
                {selectedProfileName || "Selecione uma empresa"}
              </p>
            </div>
            {hasSelectedProfile && canManageScenarios && (
              <div className="shrink-0">
                <ScenarioEditor
                  profileId={selectedProfileId!}
                  taxRuleNames={taxRuleNames}
                />
              </div>
            )}
          </div>
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
                <p className="text-xs">Use o botão &quot;Novo Cenário&quot; acima.</p>
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
                      {scenario.editar_destinatario_remessa && (
                        <Badge variant="outline" className="text-[10px]">
                          Dest. Remessa (CD ML)
                        </Badge>
                      )}
                      {scenario.editar_produtos && (
                        <Badge variant="outline" className="text-[10px]">
                          Produtos
                        </Badge>
                      )}
                      {scenario.editar_refNFe && (
                        <Badge variant="outline" className="text-[10px]">
                          Ref. NFe
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
                        taxRuleNames={taxRuleNames}
                      />
                      <ScenarioEditor
                        profileId={selectedProfileId!}
                        scenarioToEdit={scenario}
                        taxRuleNames={taxRuleNames}
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
