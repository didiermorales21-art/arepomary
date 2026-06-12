import type { AppRole } from "@/hooks/use-auth";

// Mapa de módulos -> ruta. Centraliza el control de acceso por perfil
// y deja el sistema escalable: agregar un módulo o ajustar permisos por rol
// se hace tocando solo este archivo.
export const MODULES = {
  dashboard: "/app",
  customers: "/app/customers",
  products: "/app/products",
  orders: "/app/orders",
  sales: "/app/sales",
  zones: "/app/zones",
  production: "/app/production",
  rawMaterials: "/app/raw-materials",
  warehouses: "/app/warehouses",
  inventory: "/app/inventory",
  movements: "/app/movements",
  logistics: "/app/logistics",
  invoices: "/app/invoices",
  cashbox: "/app/cashbox",
  costs: "/app/costs",
  receivables: "/app/receivables",
  suppliers: "/app/suppliers",
  payables: "/app/payables",
  reports: "/app/reports",
  analytics: "/app/analytics",
  users: "/app/users",
  sellers: "/app/sellers",
  collaborators: "/app/collaborators",
  audit: "/app/audit",
  settings: "/app/settings",
} as const;

export type ModuleKey = keyof typeof MODULES;

// "all" = acceso total. Arreglo = lista de módulos permitidos para ese rol.
// Para añadir reglas de otros perfiles, agrégalas aquí.
const ROLE_ACCESS: Record<string, ModuleKey[] | "all"> = {
  admin: "all",
  operations: "all",
  production_operator: "all",
  logistics_operator: "all",
  seller: [
    "dashboard",
    "customers",
    "orders",
    "sales",
    "receivables",
    "analytics",
    "reports",
  ],
  customer: [],
};

export function modulesForRoles(roles: AppRole[]): Set<ModuleKey> {
  if (roles.length === 0) return new Set();
  if (roles.some((r) => ROLE_ACCESS[r] === "all"))
    return new Set(Object.keys(MODULES) as ModuleKey[]);
  const set = new Set<ModuleKey>();
  roles.forEach((r) => {
    const cfg = ROLE_ACCESS[r];
    if (Array.isArray(cfg)) cfg.forEach((m) => set.add(m));
  });
  return set;
}

export function canAccessPath(path: string, roles: AppRole[]): boolean {
  const allowed = modulesForRoles(roles);
  let bestKey: ModuleKey | null = null;
  let bestLen = -1;
  for (const k of Object.keys(MODULES) as ModuleKey[]) {
    const url = MODULES[k];
    if (path === url || path.startsWith(url + "/")) {
      if (url.length > bestLen) {
        bestLen = url.length;
        bestKey = k;
      }
    }
  }
  if (!bestKey) return true;
  return allowed.has(bestKey);
}

// True cuando el usuario solo tiene rol vendedor (sin admin/operations).
// Se usa para limitar consultas a sus propios clientes/pedidos/ventas/cobros.
export function isSellerScoped(roles: AppRole[]): boolean {
  if (roles.includes("admin") || roles.includes("operations")) return false;
  return roles.includes("seller");
}
