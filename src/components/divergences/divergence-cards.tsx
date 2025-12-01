"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Building2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import {
  Bar,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

interface CompanyData {
  profileId: string;
  companyName: string;
  cnpj: string;
  totalErp: number;
  totalMl: number;
  diferenca: number;
  totalNotas: number;
  status: "ok" | "warning" | "critical";
  lastUpdate: Date;
  notes: {
    nfKey: string;
    status_conciliacao: string;
  }[];
}

interface DivergenceCardsProps {
  companies: CompanyData[];
}

export function DivergenceCards({ companies }: DivergenceCardsProps) {
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewDetails = (company: CompanyData) => {
    setSelectedCompany(company);
    setDialogOpen(true);
  };

  const getStatusConfig = (status: CompanyData["status"]) => {
    switch (status) {
      case "ok":
        return {
          icon: CheckCircle2,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          label: "Sem divergências",
          badgeVariant: "default" as const,
        };
      case "warning":
        return {
          icon: AlertCircle,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          label: "Poucas divergências",
          badgeVariant: "secondary" as const,
        };
      case "critical":
        return {
          icon: AlertTriangle,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          label: "Atenção necessária",
          badgeVariant: "destructive" as const,
        };
    }
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => {
          const statusConfig = getStatusConfig(company.status);
          const StatusIcon = statusConfig.icon;

          return (
            <Card
              key={company.profileId}
              className={`relative overflow-hidden transition-all hover:shadow-md ${statusConfig.borderColor}`}
            >
              <div
                className={`absolute top-0 left-0 w-1 h-full ${statusConfig.bgColor}`}
                style={{
                  backgroundColor:
                    company.status === "ok"
                      ? "#22c55e"
                      : company.status === "warning"
                      ? "#eab308"
                      : "#ef4444",
                }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {company.companyName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {company.cnpj}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewDetails(company)}
                    className="h-8 w-8"
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                    <span
                      className={`text-sm font-medium ${statusConfig.color}`}
                    >
                      {company.diferenca} divergência
                      {company.diferenca !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Badge variant={statusConfig.badgeVariant}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>
                    <span className="block text-xs">ERP</span>
                    <span className="font-medium text-foreground">
                      {company.totalErp}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs">Marketplace</span>
                    <span className="font-medium text-foreground">
                      {company.totalMl}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Atualizado em:{" "}
                  {new Date(company.lastUpdate).toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCompany && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedCompany.companyName}
                </DialogTitle>
                <DialogDescription>
                  CNPJ: {selectedCompany.cnpj} • Última atualização:{" "}
                  {new Date(selectedCompany.lastUpdate).toLocaleString("pt-BR")}
                </DialogDescription>
              </DialogHeader>

              {/* Cards de resumo */}
              <div className="grid gap-4 md:grid-cols-3 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total ERP
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {selectedCompany.totalErp}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Marketplace
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {selectedCompany.totalMl}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-destructive">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Diferença
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-destructive">
                      {selectedCompany.diferenca}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    Comparativo Visual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsBarChart
                      data={[
                        {
                          name: "Total ERP",
                          value: selectedCompany.totalErp,
                        },
                        {
                          name: "Total Marketplace",
                          value: selectedCompany.totalMl,
                        },
                        {
                          name: "Diferença",
                          value: selectedCompany.diferenca,
                        },
                      ]}
                    >
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="value"
                        name="Quantidade"
                        radius={[4, 4, 0, 0]}
                      >
                        <Cell fill="#8884d8" />
                        <Cell fill="#82ca9d" />
                        <Cell fill="#ef4444" />
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela de Notas */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notas Divergentes ({selectedCompany.notes.length})
                  </CardTitle>
                  <CardDescription>
                    Lista de notas fiscais com status divergente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedCompany.notes.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                      Nenhuma nota divergente encontrada
                    </div>
                  ) : (
                    <div className="rounded-md border max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Chave da NF-e</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCompany.notes.map((note) => (
                            <TableRow key={note.nfKey}>
                              <TableCell className="font-mono text-xs">
                                {note.nfKey}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="destructive">
                                  {note.status_conciliacao}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
