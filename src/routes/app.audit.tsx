import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Auditoría" description="Registro de actividad del sistema." />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Acceso restringido a administradores.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Auditoría" description="Últimas 200 acciones registradas en el sistema." />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (data ?? []).length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aún no hay registros de auditoría.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardContent className="p-0">
              <div className="divide-y">
                {(data ?? []).map((log) => (
                  <div key={log.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {log.action}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">
                          {log.entity}
                          {log.entity_id && <span className="text-muted-foreground"> · {log.entity_id.slice(0, 8)}…</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.user_email || log.user_id?.slice(0, 8) || "sistema"}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
