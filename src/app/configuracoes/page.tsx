import { db } from "@/lib/db"
import Link from "next/link" // <--- Importante: Usar o Link do Next.js
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveProfile } from "@/app/actions/settings"
import { ScenarioEditor } from "@/components/settings/scenario-editor"
import { Building2, FileCog } from "lucide-react"

// Definimos o tipo como uma Promise (Next.js 15+)
type SearchParams = Promise<{ profileId?: string }>;

export default async function SettingsPage(props: { searchParams: SearchParams }) {
  // 1. Aguardamos a resolução dos parâmetros
  const searchParams = await props.searchParams;

  // Busca todos os profiles
  const profiles = await db.profile.findMany()
  
  // Define o profile selecionado
  const selectedProfileId = searchParams.profileId || profiles[0]?.id
  const selectedProfile = profiles.find(p => p.id === selectedProfileId)

  // Busca cenários APENAS do profile selecionado
  const scenarios = selectedProfileId 
    ? await db.scenario.findMany({ 
        where: { profileId: selectedProfileId },
        orderBy: { name: 'asc' } // Opcional: Ordenar por nome
      }) 
    : []

  return (
    <div className="container mx-auto py-8 h-[calc(100vh-4rem)]">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
        
        {/* --- COLUNA ESQUERDA: LISTA DE EMPRESAS --- */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Empresas
              </CardTitle>
              <CardDescription>Selecione para ver os cenários</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-2">
              {profiles.map(profile => (
                <Link 
                  key={profile.id} 
                  // CORREÇÃO AQUI: Removemos '/dashboard' do caminho para bater com a tua rota real
                  href={`/configuracoes?profileId=${profile.id}`}
                  className={`block p-3 rounded-lg border transition-all hover:bg-slate-50 ${
                    profile.id === selectedProfileId 
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' 
                      : 'border-gray-100'
                  }`}
                >
                  <div className="font-medium flex justify-between items-center">
                    {profile.name}
                    {profile.id === selectedProfileId && (
                      <Badge variant="outline" className="text-[10px] bg-white">Ativo</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{profile.cnpj}</div>
                </Link>
              ))}

              {/* Formulário para adicionar empresa */}
              <form action={saveProfile} className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Adicionar Nova Empresa</p>
                <div className="gap-2">
                  <Input name="name" placeholder="Nome" required className="h-8 text-sm flex-1" />
                  <Input name="cnpj" placeholder="CNPJ" required className="h-8 text-sm w-50" />
                </div>
                <Button size="sm" type="submit" className="w-full">Salvar</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* --- COLUNA DIREITA: CENÁRIOS --- */}
        <div className="md:col-span-8">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCog className="h-5 w-5" /> Cenários de Teste
                </CardTitle>
                <CardDescription>
                  Gerenciando cenários de: <span className="font-bold text-primary">{selectedProfile?.name || 'Selecione...'}</span>
                </CardDescription>
              </div>
              {selectedProfileId && (
                <ScenarioEditor profileId={selectedProfileId} />
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
              {!selectedProfileId ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <Building2 className="h-10 w-10 opacity-20" />
                  <p>Selecione uma empresa ao lado para começar.</p>
                </div>
              ) : scenarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                  <FileCog className="h-10 w-10 opacity-20" />
                  <p>Nenhum cenário criado para esta empresa.</p>
                  <p className="text-xs">Clique em "Novo Cenário" acima.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {scenarios.map(scenario => (
                    <div key={scenario.id} className="bg-white border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{scenario.name}</h4>
                          <Badge 
                            variant={scenario.active ? "default" : "secondary"}
                            className={scenario.active ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            {scenario.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {scenario.reforma_tributaria && <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700">Reforma Trib.</Badge>}
                           {scenario.editar_data && <Badge variant="outline" className="text-[10px]">Data</Badge>}
                           {scenario.editar_emitente && <Badge variant="outline" className="text-[10px]">Emitente</Badge>}
                           {scenario.alterar_cUF && <Badge variant="outline" className="text-[10px]">UF</Badge>}
                        </div>
                      </div>
                      
                      <ScenarioEditor profileId={selectedProfileId} scenarioToEdit={scenario} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}