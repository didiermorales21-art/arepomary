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

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  create: { label: "Creó", variant: "default" },
  update: { label: "Actualizó", variant: "secondary" },
  delete: { label: "Eliminó", variant: "destructive" },
};

const ENTITY_LABELS: Record<string, string> = {
  customers: "un cliente",
  products: "un producto",
  orders: "un pedido",
  order_items: "un ítem del pedido",
  sales: "una venta",
  sale_items: "un ítem de venta",
  invoices: "una factura",
  invoice_items: "un ítem de factura",
  invoice_payments: "un pago de factura",
  bills: "una cuenta por pagar",
  bill_items: "un ítem de cuenta por pagar",
  bill_payments: "un pago a proveedor",
  payments: "un pago",
  suppliers: "un proveedor",
  warehouses: "un almacén",
  inventory: "el inventario",
  inventory_movements: "un movimiento de inventario",
  zones: "una zona",
  neighborhoods: "un barrio",
  drivers: "un conductor",
  shipments: "un envío",
  production_batches: "un lote de producción",
  production_costs: "un costo de producción",
  cost_items: "un concepto de costo",
  cash_movements: "una salida de caja",
  profiles: "un perfil",
  user_roles: "un rol de usuario",
  company_settings: "la configuración de la empresa",
};

const FIELD_LABELS: Record<string, string> = {
  name: "nombre",
  first_name: "nombres",
  last_name: "apellidos",
  phone: "teléfono",
  email: "correo",
  address: "dirección",
  status: "estado",
  notes: "notas",
  total: "total",
  paid: "pagado",
  balance: "saldo",
  quantity: "cantidad",
  unit_price: "precio unitario",
  price: "precio",
  wholesale_price: "precio mayorista",
  active: "activo",
  zone_id: "zona",
  neighborhood_id: "barrio",
  seller_id: "vendedor",
  customer_id: "cliente",
  supplier_id: "proveedor",
  product_id: "producto",
  category: "categoría",
  unit_cost: "costo unitario",
  unit: "unidad",
  due_date: "fecha de vencimiento",
  delivery_date: "fecha de entrega",
  scheduled_for: "programado para",
  reserved_quantity: "cantidad reservada",
  document_id: "documento",
  customer_type: "tipo de cliente",
  method: "método",
  reference: "referencia",
  description: "descripción",
};

function formatValue(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "string" && /^[0-9a-f]{8}-/.test(v)) return v.slice(0, 8) + "…";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function describeLog(log: any): { title: string; lines: string[] } {
  const act = ACTION_LABELS[log.action]?.label ?? log.action;
  const ent = ENTITY_LABELS[log.entity] ?? log.entity;
  const who = log.user_email || "el sistema";
  const title = `${who} ${act.toLowerCase()} ${ent}`;
  const lines: string[] = [];
  const details = log.details || {};

  if (log.action === "update" && details.changed) {
    Object.entries(details.changed).forEach(([key, val]: [string, any]) => {
      const label = FIELD_LABELS[key] ?? key;
      lines.push(`Cambió ${label}: ${formatValue(val?.old)} → ${formatValue(val?.new)}`);
    });
  } else if (log.action === "create" || log.action === "delete") {
    const interesting = ["name", "total", "amount", "status", "quantity", "phone", "email"];
    interesting.forEach((k) => {
      if (details[k] !== undefined && details[k] !== null && details[k] !== "") {
        const label = FIELD_LABELS[k] ?? k;
        lines.push(`${label}: ${formatValue(details[k])}`);
      }
    });
  }
  return { title, lines };
}

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
      <PageHeader title="Auditoría" description="Últimas 200 acciones registradas en el sistema, en lenguaje natural." />
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
                {(data ?? []).map((log) => {
                  const { title, lines } = describeLog(log);
                  const meta = ACTION_LABELS[log.action] ?? { label: log.action, variant: "outline" as const };
                  return (
                    <div key={log.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <Badge variant={meta.variant} className="mt-0.5">{meta.label}</Badge>
                        <div>
                          <p className="text-sm font-medium">{title}</p>
                          {lines.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {lines.map((l, i) => <li key={i}>• {l}</li>)}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground md:whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-CO")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
