import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { isValidPhone, sanitizePhoneInput, PHONE_INPUT_PROPS } from "@/lib/phone";

export const Route = createFileRoute("/app/customers")({
  component: CustomersPage,
});

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

function CustomersPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [search, setSearch] = useState("");
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
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, first_name, last_name, phone, email, address, status, document_id, neighborhood_id, seller_id, customer_type, created_at, neighborhoods(name, zones(name))")
        .order("created_at", { ascending: false });
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
    if (!q) return customers ?? [];
    return (customers ?? []).filter(
      (c: any) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.document_id?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const createMutation = useMutation({
    mutationFn: async (input: {
      first_name: string;
      last_name: string;
      document_id: string;
      phone: string;
      email: string;
      address: string;
      neighborhood_id: string | null;
      notes: string;
      seller_id: string;
    }) => {
      if (!user) throw new Error("Sin sesión");
      if (!isValidPhone(input.phone)) {
        throw new Error("El teléfono debe tener 10 dígitos y comenzar con 3");
      }
      if (!input.seller_id) {
        throw new Error("Debes seleccionar un vendedor");
      }
      if (!input.first_name.trim()) throw new Error("Los nombres son obligatorios");
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
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente creado");
      setOpen(false);
      setPhone("");
      setSellerId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      first_name: string;
      last_name: string;
      document_id: string;
      phone: string;
      email: string;
      address: string;
      neighborhood_id: string | null;
      notes: string;
      seller_id: string;
      status: string;
      customer_type?: string;
    }) => {
      if (input.phone && !isValidPhone(input.phone)) {
        throw new Error("El teléfono debe tener 10 dígitos y comenzar con 3");
      }
      if (!input.seller_id) throw new Error("Debes seleccionar un vendedor");
      if (!input.first_name.trim()) throw new Error("Los nombres son obligatorios");
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
      };
      if (input.customer_type) update.customer_type = input.customer_type;
      const { error } = await supabase
        .from("customers")
        .update(update)
        .eq("id", input.id);
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
                <Plus className="mr-1 h-4 w-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Nuevo cliente</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
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
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="document_id">Documento</Label>
                    <Input id="document_id" name="document_id" inputMode="numeric" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      required
                      {...PHONE_INPUT_PROPS}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nombres</Label>
                    <Input id="first_name" name="first_name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Apellidos</Label>
                    <Input id="last_name" name="last_name" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood_id">Barrio</Label>
                  <Select name="neighborhood_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un barrio" />
                    </SelectTrigger>
                    <SelectContent>
                      {(neighborhoods ?? []).map((n: any) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name}
                          {n.zones?.name && <span className="text-muted-foreground"> · {n.zones.name}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    La zona se asigna automáticamente según el barrio.
                  </p>
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="seller_id">Vendedor asignado</Label>
                    <Select value={sellerId} onValueChange={setSellerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sellers ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name || "—"}
                            {s.id === COMPANY_ID && <span className="text-muted-foreground"> · empresa</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-primary">
                    {createMutation.isPending ? "Guardando…" : "Guardar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-4 p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, documento, teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Barrio</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No hay clientes todavía. Crea el primero.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.document_id || "—"}</TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell>{c.neighborhoods?.name || "—"}</TableCell>
                    <TableCell>{c.neighborhoods?.zones?.name || "—"}</TableCell>
                    <TableCell className="text-xs">{sellerNameMap.get(c.seller_id) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.customer_type === "wholesale" ? "default" : "outline"}>
                        {c.customer_type === "wholesale" ? "Comercial" : "Estándar"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}

            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar cliente</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-4"
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
                });

              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="e_document_id">Documento</Label>
                  <Input id="e_document_id" name="document_id" defaultValue={editing.document_id || ""} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_phone">Teléfono</Label>
                  <Input
                    id="e_phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(sanitizePhoneInput(e.target.value))}
                    {...PHONE_INPUT_PROPS}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="e_first_name">Nombres</Label>
                  <Input id="e_first_name" name="first_name" defaultValue={editing.first_name || ""} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e_last_name">Apellidos</Label>
                  <Input id="e_last_name" name="last_name" defaultValue={editing.last_name || ""} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="e_email">Email</Label>
                <Input id="e_email" name="email" type="email" defaultValue={editing.email || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_address">Dirección</Label>
                <Input id="e_address" name="address" defaultValue={editing.address || ""} />
              </div>
              <div className="space-y-2">
                <Label>Barrio</Label>
                <Select value={editNeighborhoodId} onValueChange={setEditNeighborhoodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un barrio" />
                  </SelectTrigger>
                  <SelectContent>
                    {(neighborhoods ?? []).map((n: any) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                        {n.zones?.name && <span className="text-muted-foreground"> · {n.zones.name}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Vendedor asignado</Label>
                  <Select value={editSellerId} onValueChange={setEditSellerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sellers ?? []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name || "—"}
                          {s.id === COMPANY_ID && <span className="text-muted-foreground"> · empresa</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select value={editCustomerType} onValueChange={setEditCustomerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Estándar (precio normal)</SelectItem>
                      <SelectItem value="wholesale">Comercial (precio al por mayor)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Solo el administrador puede modificar el tipo de cliente.
                  </p>
                </div>
              )}
              <div className="space-y-2">

                <Label>Estado</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="e_notes">Notas</Label>
                <Textarea id="e_notes" name="notes" defaultValue={editing.notes || ""} rows={3} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} className="bg-gradient-primary">
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
