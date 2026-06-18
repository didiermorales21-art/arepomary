import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { isValidPhone, sanitizePhoneInput, PHONE_INPUT_PROPS } from "@/lib/phone";
import { isSellerScoped } from "@/lib/rbac";

export const Route = createFileRoute("/app/customers")({
  component: CustomersPage,
});

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

function CustomersPage() {
  const qc = useQueryClient();
  const { user, roles, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const sellerOnly = isSellerScoped(roles);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sellerId, setSellerId] = useState<string>("");
  const [givesCommission, setGivesCommission] = useState(true);
  const [commissionOverride, setCommissionOverride] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editSellerId, setEditSellerId] = useState<string>("");
  const [editNeighborhoodId, setEditNeighborhoodId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editCustomerType, setEditCustomerType] = useState<string>("standard");
  const [editGivesCommission, setEditGivesCommission] = useState(true);
  const [editCommissionOverride, setEditCommissionOverride] = useState<string>("");

  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: async () =>
      (await supabase.from("neighborhoods").select("id, name, zones(name)").eq("active", true).order("name")).data ?? [],
  });

  const { data: sellers } = useQuery({
    queryKey: ["sellers-options"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "seller");
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (profiles ?? []).sort((a, b) =>
        a.id === COMPANY_ID ? -1 : b.id === COMPANY_ID ? 1 : (a.full_name || "").localeCompare(b.full_name || ""),
      );
    },
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", sellerOnly ? user?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("id, name, first_name, last_name, phone, email, address, status, document_id, neighborhood_id, seller_id, customer_type, gives_commission, commission_per_package, created_at, neighborhoods(name, zones(name))")
        .order("created_at", { ascending: false });
      if (sellerOnly && user) query = query.eq("seller_id", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const sellerNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (sellers ?? []).forEach((s) => m.set(s.id, s.full_name || "—"));
    return m;
  }, [sellers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (customers ?? []).filter((c: any) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (isAdmin && sellerFilter !== "all" && c.seller_id !== sellerFilter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.document_id?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      );
    });
  }, [customers, search, statusFilter, sellerFilter, isAdmin]);

  function downloadCsv() {
    const rows = filtered as any[];
    const header = ["Nombre","Documento","Teléfono","Email","Dirección","Barrio","Vendedor","Tipo","Estado"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(";")];
    for (const c of rows) {
      lines.push([
        c.name, c.document_id || "", c.phone || "", c.email || "", c.address || "",
        c.neighborhoods?.name || "", sellerNameMap.get(c.seller_id) || "",
        c.customer_type === "wholesale" ? "Comercial" : "Estándar", c.status,
      ].map(esc).join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      if (!user) throw new Error("Sin sesión");
      if (!isValidPhone(input.phone)) throw new Error("El teléfono debe tener 10 dígitos y comenzar con 3");
      if (!input.seller_id) throw new Error("Debes seleccionar un vendedor");
      if (!input.first_name.trim()) throw new Error("Los nombres son obligatorios");
      if (!input.last_name.trim()) throw new Error("Los apellidos son obligatorios");
      if (!input.address.trim()) throw new Error("La dirección es obligatoria");
      if (!input.neighborhood_id) throw new Error("El barrio es obligatorio");
      const composed = `${input.first_name} ${input.last_name}`.trim();
      const { error } = await supabase.from("customers").insert({
        name: composed,
        first_name: input.first_name,
        last_name: input.last_name || null,
        document_id: input.document_id || null,
        phone: input.phone,
        email: input.email || null,
        address: input.address,
        neighborhood_id: input.neighborhood_id,
        notes: input.notes,
        seller_id: input.seller_id,
        gives_commission: input.gives_commission,
        commission_per_package: input.commission_per_package,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente creado");
      setOpen(false);
      setPhone("");
      setSellerId("");
      setGivesCommission(true);
      setCommissionOverride("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: any) => {
      if (input.phone && !isValidPhone(input.phone)) throw new Error("El teléfono debe tener 10 dígitos y comenzar con 3");
      if (!input.seller_id) throw new Error("Debes seleccionar un vendedor");
      if (!input.first_name.trim()) throw new Error("Los nombres son obligatorios");
      if (!input.last_name.trim()) throw new Error("Los apellidos son obligatorios");
      if (!input.address.trim()) throw new Error("La dirección es obligatoria");
      if (!input.neighborhood_id) throw new Error("El barrio es obligatorio");
      const composed = `${input.first_name} ${input.last_name}`.trim();
      const update: any = {
        name: composed,
        first_name: input.first_name,
        last_name: input.last_name || null,
        document_id: input.document_id || null,
        phone: input.phone,
        email: input.email || null,
        address: input.address,
        neighborhood_id: input.neighborhood_id,
        notes: input.notes,
        seller_id: input.seller_id,
        status: input.status,
        gives_commission: input.gives_commission,
        commission_per_package: input.commission_per_package,
      };
      if (input.customer_type) update.customer_type = input.customer_type;
      const { error } = await supabase.from("customers").update(update).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente actualizado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(c: any) {
    setEditing(c);
    setEditPhone(c.phone || "");
    setEditSellerId(c.seller_id || "");
    setEditNeighborhoodId(c.neighborhood_id || "");
    setEditStatus(c.status || "active");
    setEditCustomerType(c.customer_type || "standard");
    setEditGivesCommission(c.gives_commission !== false);
    setEditCommissionOverride(c.commission_per_package != null ? String(c.commission_per_package) : "");
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Gestiona la base de clientes y su asignación por barrio."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4">
              <DialogHeader className="pb-2">
                <DialogTitle className="font-display">Nuevo cliente</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createMutation.mutate({
                    first_name: String(fd.get("first_name") || ""),
                    last_name: String(fd.get("last_name") || ""),
                    document_id: String(fd.get("document_id") || ""),
                    phone,
                    email: String(fd.get("email") || ""),
                    address: String(fd.get("address") || ""),
                    neighborhood_id: (fd.get("neighborhood_id") as string) || null,
                    notes: String(fd.get("notes") || ""),
                    seller_id: isAdmin ? sellerId : (user?.id ?? COMPANY_ID),
                    gives_commission: givesCommission,
                    commission_per_package: commissionOverride ? Number(commissionOverride) : null,
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Documento <span className="text-muted-foreground">(opcional)</span></Label><Input name="document_id" className="h-8 text-sm" inputMode="numeric" /></div>
                  <div className="space-y-1"><Label className="text-xs">Teléfono</Label><Input value={phone} className="h-8 text-sm" onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))} required {...PHONE_INPUT_PROPS} /></div>
                  <div className="space-y-1"><Label className="text-xs">Nombres</Label><Input name="first_name" className="h-8 text-sm" required /></div>
                  <div className="space-y-1"><Label className="text-xs">Apellidos</Label><Input name="last_name" className="h-8 text-sm" required /></div>
                  <div className="space-y-1"><Label className="text-xs">Email <span className="text-muted-foreground">(opcional)</span></Label><Input name="email" type="email" className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Dirección</Label><Input name="address" className="h-8 text-sm" required /></div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Barrio</Label>
                    <Select name="neighborhood_id" required>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona un barrio" /></SelectTrigger>
                      <SelectContent>
                        {(neighborhoods ?? []).map((n: any) => (
                          <SelectItem key={n.id} value={n.id}>{n.name}{n.zones?.name && <span className="text-muted-foreground"> · {n.zones.name}</span>}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isAdmin && (
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Vendedor asignado</Label>
                      <Select value={sellerId} onValueChange={setSellerId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona un vendedor" /></SelectTrigger>
                        <SelectContent>
                          {(sellers ?? []).map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name || "—"}{s.id === COMPANY_ID && <span className="text-muted-foreground"> · empresa</span>}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="rounded-md border p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Aplica comisión al vendedor</Label>
                    <Switch checked={givesCommission} onCheckedChange={setGivesCommission} />
                  </div>
                  {givesCommission && (
                    <div className="space-y-1">
                      <Label className="text-xs">Comisión por paquete (opcional, sobrescribe global)</Label>
                      <Input type="number" step="1" className="h-8 text-sm" placeholder="Usar global por tipo de cliente"
                        value={commissionOverride} onChange={(e) => setCommissionOverride(e.target.value)} />
                    </div>
                  )}
                </div>

                <div className="space-y-1"><Label className="text-xs">Notas</Label><Textarea name="notes" rows={2} className="text-sm" /></div>
                <DialogFooter className="pt-1">
                  <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-primary h-8 text-sm">
                    {createMutation.isPending ? "Guardando…" : "Guardar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, documento, teléfono…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vendedores</SelectItem>
                {(sellers ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || "—"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={downloadCsv} className="ml-auto">
            <Download className="mr-1 h-4 w-4" /> Descargar CSV
          </Button>
        </div>

        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Barrio</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No hay clientes todavía. Crea el primero.</TableCell></TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.document_id || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{c.neighborhoods?.name || "—"}</TableCell>
                    <TableCell className="text-xs">{sellerNameMap.get(c.seller_id) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.customer_type === "wholesale" ? "default" : "outline"}>
                        {c.customer_type === "wholesale" ? "Comercial" : "Estándar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.gives_commission === false ? (
                        <span className="text-muted-foreground">No aplica</span>
                      ) : c.commission_per_package != null ? (
                        <span className="font-medium">${Number(c.commission_per_package).toLocaleString("es-CO")}</span>
                      ) : (
                        <span className="text-muted-foreground">Global</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-display">Editar cliente</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: editing.id,
                  first_name: String(fd.get("first_name") || ""),
                  last_name: String(fd.get("last_name") || ""),
                  document_id: String(fd.get("document_id") || ""),
                  phone: editPhone,
                  email: String(fd.get("email") || ""),
                  address: String(fd.get("address") || ""),
                  neighborhood_id: editNeighborhoodId || null,
                  notes: String(fd.get("notes") || ""),
                  seller_id: isAdmin ? editSellerId : (editing.seller_id || user?.id || COMPANY_ID),
                  status: editStatus,
                  customer_type: isAdmin ? editCustomerType : undefined,
                  gives_commission: editGivesCommission,
                  commission_per_package: editCommissionOverride ? Number(editCommissionOverride) : null,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Documento</Label><Input name="document_id" className="h-8 text-sm" defaultValue={editing.document_id || ""} inputMode="numeric" /></div>
                <div className="space-y-1"><Label className="text-xs">Teléfono</Label><Input value={editPhone} className="h-8 text-sm" onChange={(e) => setEditPhone(sanitizePhoneInput(e.target.value))} {...PHONE_INPUT_PROPS} /></div>
                <div className="space-y-1"><Label className="text-xs">Nombres</Label><Input name="first_name" className="h-8 text-sm" defaultValue={editing.first_name || ""} required /></div>
                <div className="space-y-1"><Label className="text-xs">Apellidos</Label><Input name="last_name" className="h-8 text-sm" defaultValue={editing.last_name || ""} /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input name="email" type="email" className="h-8 text-sm" defaultValue={editing.email || ""} /></div>
                <div className="space-y-1"><Label className="text-xs">Dirección</Label><Input name="address" className="h-8 text-sm" defaultValue={editing.address || ""} /></div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Barrio</Label>
                  <Select value={editNeighborhoodId} onValueChange={setEditNeighborhoodId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona un barrio" /></SelectTrigger>
                    <SelectContent>
                      {(neighborhoods ?? []).map((n: any) => (
                        <SelectItem key={n.id} value={n.id}>{n.name}{n.zones?.name && <span className="text-muted-foreground"> · {n.zones.name}</span>}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <div className="space-y-1">
                    <Label className="text-xs">Vendedor</Label>
                    <Select value={editSellerId} onValueChange={setEditSellerId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {(sellers ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name || "—"}{s.id === COMPANY_ID && <span className="text-muted-foreground"> · empresa</span>}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isAdmin && (
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={editCustomerType} onValueChange={setEditCustomerType}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Estándar</SelectItem>
                        <SelectItem value="wholesale">Comercial (mayorista)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Aplica comisión al vendedor</Label>
                  <Switch checked={editGivesCommission} onCheckedChange={setEditGivesCommission} />
                </div>
                {editGivesCommission && (
                  <div className="space-y-1">
                    <Label className="text-xs">Comisión por paquete (opcional, sobrescribe global)</Label>
                    <Input type="number" step="1" className="h-8 text-sm" placeholder="Usar global por tipo de cliente"
                      value={editCommissionOverride} onChange={(e) => setEditCommissionOverride(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="space-y-1"><Label className="text-xs">Notas</Label><Textarea name="notes" defaultValue={editing.notes || ""} rows={2} className="text-sm" /></div>
              <DialogFooter className="pt-1">
                <Button type="submit" disabled={updateMutation.isPending} className="bg-gradient-primary h-8 text-sm">
                  {updateMutation.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
