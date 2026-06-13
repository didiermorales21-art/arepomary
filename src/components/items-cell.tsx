import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ItemLite = { name: string; quantity: number };

export function summarizeItems(items: ItemLite[] | null | undefined, max = 3): string {
  if (!items || items.length === 0) return "—";
  const head = items.slice(0, max).map((i) => `${i.quantity}× ${i.name}`).join(", ");
  const more = items.length - max;
  return more > 0 ? `${head} (+${more} más)` : head;
}

export function ItemsToggle({
  items,
  open,
  onToggle,
}: {
  items: ItemLite[] | null | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const list = items ?? [];
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="h-auto w-full justify-start gap-1 whitespace-normal p-0 text-left text-xs font-normal hover:bg-transparent hover:underline"
      title="Ver detalle de productos"
    >
      {open ? (
        <ChevronDown className="mt-0.5 h-3 w-3 flex-shrink-0" />
      ) : (
        <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0" />
      )}
      <span className="min-w-0">{summarizeItems(list)}</span>
    </Button>
  );
}

export function ItemsDetail({ items }: { items: ItemLite[] | null | undefined }) {
  const list = items ?? [];
  if (!list.length) return <span className="text-xs text-muted-foreground">Sin productos</span>;
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      {list.map((i, idx) => (
        <li key={idx}>
          <span className="font-medium text-foreground">{i.quantity}×</span> {i.name}
        </li>
      ))}
    </ul>
  );
}
