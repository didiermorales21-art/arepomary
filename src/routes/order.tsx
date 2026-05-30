import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { sanitizePhoneInput, isValidPhone, PHONE_INPUT_PROPS } from "@/lib/phone";

export const Route = createFileRoute("/order")({
  component: GuestOrderPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

interface LineDraft {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
}

const COMPANY_SELLER_ID = "00000000-0000-0000-0000-000000000001";

function GuestOrderPage() {
  const navigate = useNavigate();
  const [document_id, setDocumentId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [notes, setNotes] = useState("");
  const [sellerMode, setSellerMode] = useState<"alone" | "referred">("alone");
  const [sellerId, setSellerId] = useState<string>("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["public-products-all"],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, price, unit, image_url").eq("active", true).order("name")).data ?? [],
  });

  const { data: neighborhoods } = useQuery({
    queryKey: ["public-neighborhoods"],
    queryFn: async () =>
      (await supabase.from("neighborhoods").select("id, name, zones(name)").eq("active", true).order("name")).data ?? [],
  });

  const { data: sellers } = useQuery({
    queryKey: ["public-sellers"],
    queryFn: async () => {
      const { data } = await supabase.rpc("list_public_sellers" as any);
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  // Auto-lookup when document_id reaches a reasonable length
  useEffect(() => {
    if (document_id.trim().length < 5) return;
    const t = setTimeout(async () => {
      setLookingUp(true);
      const { data } = await supabase.rpc("lookup_customer_by_document" as any, {
        _document_id: document_id.trim(),
      });
      setLookingUp(false);
      const row = Array.isArray(data) ? data[0] : null;
      if (row) {
        setName(row.name ?? "");
        setPhone(row.phone ?? "");
        setAddress(row.address ?? "");
        if (row.neighborhood_id) setNeighborhoodId(row.neighborhood_id);
        if (row.seller_id) {
          if (row.seller_id === COMPANY_SELLER_ID) {
            setSellerMode("alone");
            setSellerId("");
          } else {
            setSellerMode("referred");
            setSellerId(row.seller_id);
          }
        }
        toast.success("Cliente reconocido. Datos autocompletados.");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [document_id]);

  function addLine(productId: string) {
    const p = (products ?? []).find((pp) => pp.id === productId);
    if (!p) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === productId);
      if (existing) {
        return prev.map((l) =>
          l.product_id === productId ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product_id: p.id, name: p.name, unit_price: Number(p.price), quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.product_id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) {
      toast.error("El teléfono debe tener 10 dígitos y comenzar con 3.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Agrega al menos un producto.");
      return;
    }
    if (sellerMode === "referred" && !sellerId) {
      toast.error("Selecciona el vendedor que te refirió o marca 'Llegué por mi cuenta'.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_guest_order", {
      _name: name,
      _document_id: document_id.trim(),
      _phone: phone,
      _address: address,
      _neighborhood_id: neighborhoodId || null,
      _notes: notes,
      _items: lines.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
      })),
      _seller_id: sellerMode === "referred" ? sellerId : COMPANY_SELLER_ID,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`¡Pedido enviado! Referencia: ${String(data).slice(0, 8)}`);
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Inicio
          </Link>
        </Button>
        <h1 className="font-display text-base font-semibold">Hacer pedido</h1>
      </header>

      <form onSubmit={onSubmit} className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">1. Tus datos</h2>
              <p className="text-sm text-muted-foreground">
                Ingresa tu número de documento. Si ya eres cliente, autocompletamos el resto.
              </p>
              <div className="space-y-2">
                <Label htmlFor="document_id">Número de documento</Label>
                <Input
                  id="document_id"
                  value={document_id}
                  onChange={(e) => setDocumentId(e.target.value.replace(/\D+/g, ""))}
                  inputMode="numeric"
                  required
                  placeholder="CC / NIT"
                />
                {lookingUp && <p className="text-xs text-muted-foreground">Buscando…</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
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
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Barrio</Label>
                <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
                  <SelectTrigger id="neighborhood">
                    <SelectValue placeholder="Selecciona tu barrio" />
                  </SelectTrigger>
                  <SelectContent>
                    {(neighborhoods ?? []).map((n: any) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                        {n.zones?.name && (
                          <span className="text-muted-foreground"> · {n.zones.name}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label>¿Un vendedor te refirió?</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={sellerMode === "alone" ? "default" : "outline"}
                    onClick={() => {
                      setSellerMode("alone");
                      setSellerId("");
                    }}
                  >
                    Llegué por mi cuenta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sellerMode === "referred" ? "default" : "outline"}
                    onClick={() => setSellerMode("referred")}
                  >
                    Me refirió un vendedor
                  </Button>
                </div>
                {sellerMode === "referred" && (
                  <Select value={sellerId} onValueChange={setSellerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sellers ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">2. Elige los productos</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(products ?? []).map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => addLine(p.id)}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:shadow-card"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.unit}</p>
                    </div>
                    <span className="font-display font-semibold whitespace-nowrap">{fmt(Number(p.price))}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="sticky top-20 shadow-elegant">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Tu pedido</h2>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no has elegido productos.</p>
              ) : (
                <div className="divide-y">
                  {lines.map((l) => (
                    <div key={l.product_id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{fmt(l.unit_price)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => changeQty(l.product_id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{l.quantity}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => changeQty(l.product_id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-semibold">{fmt(total)}</span>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-primary shadow-elegant"
                size="lg"
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                {submitting ? "Enviando…" : "Enviar pedido"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="underline">
                  Ingresa
                </Link>
              </p>
            </CardContent>
          </Card>
        </aside>
      </form>
    </div>
  );
}
