import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      if (!data?.id) throw new Error("Sin registro");
      const { error } = await supabase.from("company_settings").update(input).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Configuración actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Parámetros generales de la empresa."
      />
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <Card className="max-w-3xl shadow-card">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                  <SettingsIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold">Datos de la empresa</h3>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? "Solo administradores pueden editar." : "Solo lectura."}
                  </p>
                </div>
              </div>
              <form
                className="grid gap-4 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  updateMutation.mutate({
                    company_name: String(fd.get("company_name") || ""),
                    legal_name: String(fd.get("legal_name") || ""),
                    tax_id: String(fd.get("tax_id") || ""),
                    email: String(fd.get("email") || ""),
                    phone: String(fd.get("phone") || ""),
                    address: String(fd.get("address") || ""),
                    currency: String(fd.get("currency") || "COP"),
                    tax_rate: Number(fd.get("tax_rate") || 0),
                  });
                }}
              >
                <Field name="company_name" label="Nombre comercial" defaultValue={data?.company_name ?? ""} disabled={!isAdmin} />
                <Field name="legal_name" label="Razón social" defaultValue={data?.legal_name ?? ""} disabled={!isAdmin} />
                <Field name="tax_id" label="NIT / RUT" defaultValue={data?.tax_id ?? ""} disabled={!isAdmin} />
                <Field name="email" label="Email" type="email" defaultValue={data?.email ?? ""} disabled={!isAdmin} />
                <Field name="phone" label="Teléfono" defaultValue={data?.phone ?? ""} disabled={!isAdmin} />
                <Field name="address" label="Dirección" defaultValue={data?.address ?? ""} disabled={!isAdmin} />
                <Field name="currency" label="Moneda" defaultValue={data?.currency ?? "COP"} disabled={!isAdmin} />
                <Field name="tax_rate" label="IVA (%)" type="number" defaultValue={String(data?.tax_rate ?? 0)} disabled={!isAdmin} />
                {isAdmin && (
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={updateMutation.isPending} className="bg-gradient-primary">
                      Guardar cambios
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  disabled,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} disabled={disabled} />
    </div>
  );
}
