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
import { Settings as SettingsIcon, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

const WEEKDAYS: Array<{ value: number; label: string; short: string }> = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miércoles", short: "Mié" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
];

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

  const [deliveryDays, setDeliveryDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  useEffect(() => {
    const dd = (data as any)?.delivery_days;
    if (Array.isArray(dd)) setDeliveryDays(dd);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (input: Record<string, any>) => {
      if (!data?.id) throw new Error("Sin registro");
      const { error } = await (supabase.from("company_settings") as any).update(input).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      qc.invalidateQueries({ queryKey: ["delivery-days"] });
      toast.success("Configuración actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDay(v: number) {
    setDeliveryDays((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b),
    );
  }

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Parámetros generales de la empresa."
      />
      <div className="space-y-6 p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
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
                  <Field name="legal_name" label="Razón social" defaultValue={(data as any)?.legal_name ?? ""} disabled={!isAdmin} />
                  <Field name="tax_id" label="NIT / RUT" defaultValue={(data as any)?.tax_id ?? ""} disabled={!isAdmin} />
                  <Field name="email" label="Email" type="email" defaultValue={(data as any)?.email ?? ""} disabled={!isAdmin} />
                  <Field name="phone" label="Teléfono" defaultValue={(data as any)?.phone ?? ""} disabled={!isAdmin} />
                  <Field name="address" label="Dirección" defaultValue={(data as any)?.address ?? ""} disabled={!isAdmin} />
                  <Field name="currency" label="Moneda" defaultValue={data?.currency ?? "COP"} disabled={!isAdmin} />
                  <Field name="tax_rate" label="IVA (%)" type="number" defaultValue={String((data as any)?.tax_rate ?? 0)} disabled={!isAdmin} />
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

            <Card className="max-w-3xl shadow-card">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold">Días de entrega disponibles</h3>
                    <p className="text-xs text-muted-foreground">
                      Define los días de la semana en los que se pueden programar entregas. Las demás
                      fechas quedarán bloqueadas al crear pedidos.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => {
                    const active = deliveryDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => toggleDay(d.value)}
                        className={`rounded-md border px-3 py-2 text-sm transition ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-input bg-background text-muted-foreground hover:bg-accent"
                        } ${!isAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {isAdmin && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      onClick={() => updateMutation.mutate({ delivery_days: deliveryDays })}
                      disabled={updateMutation.isPending}
                      className="bg-gradient-primary"
                    >
                      Guardar días
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
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
