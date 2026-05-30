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
  const [editing, setEditing] = useState<any | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editSellerId, setEditSellerId] = useState<string>("");
  const [editNeighborhoodId, setEditNeighborhoodId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("active");

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
        .select("id, name, phone, address, status, document_id, neighborhood_id, seller_id, created_at, neighborhoods(name, zones(name))")
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
      name: string;
      document_id: string;
      phone: string;
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
      const { error } = await supabase.from("customers").insert({
        name: input.name,
        document_id: input.document_id || null,
        phone: input.phone,
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
      name: string;
      document_id: string;
      phone: string;
      address: string;
      neighborhood_id: string | null;
      notes: string;
      seller_id: string;
      status: string;
    }) => {
      if (input.phone && !isValidPhone(input.phone)) {
        throw new Error("El teléfono debe tener 10 dígitos y comenzar con 3");
      }
      if (!input.seller_id) throw new Error("Debes seleccionar un vendedor");
      const { error } = await supabase
        .from("customers")
        .update({
          name: input.name,
          document_id: input.document_id || null,
          phone: input.phone,
          address: input.address,
          neighborhood_id: input.neighborhood_id,
          notes: input.notes,
          seller_id: input.seller_id,
          status: input.status as any,
        } as any)
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
                    name: String(fd.get("name") || ""),
                    document_id: String(fd.get("document_id") || ""),
                    phone,
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
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" required />
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
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
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
    </>
  );
}
