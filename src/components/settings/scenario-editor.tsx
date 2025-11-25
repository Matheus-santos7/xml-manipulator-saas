'use client'

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { saveScenario } from "@/app/actions/settings"
import { toast } from "sonner"
import { useState } from "react"
import { Plus } from "lucide-react"

// Schema simples para o form
const formSchema = z.object({
  id: z.string().optional(),
  profileId: z.string(),
  name: z.string().min(2, "Nome muito curto"),
  active: z.boolean().default(true),
  editar_data: z.boolean().default(false),
  nova_data: z.string().optional(),
  alterar_serie: z.boolean().default(false),
  nova_serie: z.string().optional(),
  alterar_cUF: z.boolean().default(false),
  novo_cUF: z.string().optional(),
  editar_emitente: z.boolean().default(false),
  reforma_tributaria: z.boolean().default(false),
  emitente: z.string().optional(), // JSON string
})

export function ScenarioEditor({ profileId, scenarioToEdit }: { profileId: string, scenarioToEdit?: any }) {
  const [open, setOpen] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: scenarioToEdit || {
      profileId: profileId,
      name: "",
      active: true,
      editar_data: false,
      alterar_serie: false,
      alterar_cUF: false,
      editar_emitente: false,
      reforma_tributaria: false,
      emitente: '{\n  "CNPJ": "00000000000000",\n  "xNome": "Empresa Teste LTDA",\n  "xLgr": "Rua Exemplo"\n}',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await saveScenario({ ...values, profileId })
      toast.success("Cenário salvo com sucesso!")
      setOpen(false)
      form.reset()
    } catch (error) {
      toast.error("Erro ao salvar cenário")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {scenarioToEdit ? (
          <Button variant="outline" size="sm">Editar</Button>
        ) : (
          <Button><Plus className="mr-2 h-4 w-4" /> Novo Cenário</Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[800px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{scenarioToEdit ? "Editar Cenário" : "Criar Novo Cenário"}</SheetTitle>
        </SheetHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cenário</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Reforma Tributária - SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
              <h3 className="font-semibold text-sm">Regras de Data e Série</h3>
              
              <div className="flex items-center justify-between">
                <FormField control={form.control} name="editar_data" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Editar Data</FormLabel>
                  </FormItem>
                )} />
                {form.watch("editar_data") && (
                   <FormField control={form.control} name="nova_data" render={({ field }) => (
                    <Input placeholder="DD/MM/AAAA" className="w-32" {...field} />
                  )} />
                )}
              </div>

              <div className="flex items-center justify-between">
                <FormField control={form.control} name="alterar_serie" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Alterar Série</FormLabel>
                  </FormItem>
                )} />
                {form.watch("alterar_serie") && (
                   <FormField control={form.control} name="nova_serie" render={({ field }) => (
                    <Input placeholder="001" className="w-32" {...field} />
                  )} />
                )}
              </div>
            </div>

            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
               <h3 className="font-semibold text-sm">Dados Fiscais</h3>
               <FormField control={form.control} name="reforma_tributaria" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Aplicar Reforma Tributária (IBS/CBS)</FormLabel>
                    <FormDescription>Calcula automaticamente blocos IBSCBS</FormDescription>
                  </FormItem>
                )} />

                <FormField control={form.control} name="editar_emitente" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Forçar Dados do Emitente</FormLabel>
                  </FormItem>
                )} />
                
                {form.watch("editar_emitente") && (
                   <FormField control={form.control} name="emitente" render={({ field }) => (
                    <FormItem>
                      <FormLabel>JSON do Emitente</FormLabel>
                      <FormControl>
                        <Textarea className="font-mono text-xs" rows={5} {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                )}
            </div>

            <Button type="submit" className="w-full">Salvar Configurações</Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}