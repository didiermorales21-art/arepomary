# Fase 5 — Finanzas y cierre

Cierre del ERP Arepomary con facturación completa (CxC + CxP), reportes exportables a PDF/Excel y dashboard con datos reales.

## 1. Base de datos (1 migración)

**Tablas nuevas (todas con RLS + GRANT a `authenticated`/`service_role`):**

- `suppliers` — proveedores: `name`, `tax_id`, `email`, `phone`, `address`, `active`. Gestión: admin/operations.
- `invoices` — facturas emitidas a clientes:
  - `invoice_number` (secuencia), `sale_id` (FK opcional), `customer_id`, `issued_at`, `due_date`, `subtotal`, `tax`, `total`, `paid`, `balance` (generada), `status` (`draft|issued|paid|overdue|cancelled`), `notes`, `pdf_url`.
  - RLS: admin all; seller ve las de sus ventas; portal cliente ve las suyas vía `customers.portal_user_id`.
- `invoice_items` — líneas de factura (`product_id`, `quantity`, `unit_price`, `line_total`). Trigger para recalcular totales de factura (reutiliza patrón `tg_sale_items_recalc`).
- `bills` — cuentas por pagar a proveedores: `bill_number`, `supplier_id`, `issued_at`, `due_date`, `subtotal`, `tax`, `total`, `paid`, `balance`, `status`, `notes`. Solo admin/operations.
- `bill_items` — líneas de bill.
- `bill_payments` — pagos a proveedores (`bill_id`, `amount`, `method`, `paid_at`, `reference`, `recorded_by`). Trigger recalcula `paid`/`status` en `bills`.

**Enums:** `invoice_status`, `bill_status`, reutilizar `payment_method` existente.

**Funciones/triggers:**
- `recalc_invoice_totals(_invoice_id)` y `tg_invoice_items_recalc`.
- `recalc_bill_totals(_bill_id)` y `tg_bill_items_recalc`.
- `tg_invoice_payments_recalc` sobre `payments` (extender o crear espejo para bills).
- Función `mark_overdue_invoices()` que actualiza status según `due_date < now()` (se podrá llamar al cargar el módulo).

## 2. Módulos nuevos (rutas)

Todas con `PageHeader`, botón "Atrás", patrón `useQuery`/`useMutation` ya establecido.

- `src/routes/app.invoices.tsx` — listado de facturas con filtros (estado, cliente, rango fecha), crear factura desde una venta existente o manual, ver detalle, exportar PDF, exportar listado Excel.
- `src/routes/app.invoices.$id.tsx` — detalle de factura: líneas, pagos asociados, botón "Descargar PDF", botón "Registrar pago".
- `src/routes/app.receivables.tsx` — **Cuentas por cobrar**: tabla de saldos pendientes por cliente con aging buckets (0-30 / 31-60 / 61-90 / +90), totales por columna, exportable.
- `src/routes/app.suppliers.tsx` — CRUD de proveedores (admin/operations).
- `src/routes/app.payables.tsx` — **Cuentas por pagar**: listado de `bills`, crear bill, registrar pagos, aging por proveedor.
- `src/routes/app.reports.tsx` — Centro de reportes (índice/cards):
  - Ventas por período
  - Inventario valorizado (qty × `unit_cost` promedio)
  - Producción (lotes, rendimiento, costo unitario)
  - Cobranza (CxC)
  - Pagos a proveedores (CxP)
  - Cada uno con selector de rango de fechas y botones "PDF" / "Excel".

## 3. Exportación PDF / Excel (cliente)

**Librerías a instalar:**
- `jspdf` + `jspdf-autotable` — generación de PDF en el navegador.
- `xlsx` (SheetJS, paquete `xlsx`) — generación de Excel en el navegador.

**Patrón:** helper único `src/lib/export.ts` con:
- `exportToPdf(title, columns, rows, meta?)` — incluye logo/nombre de empresa desde `company_settings`, fecha y paginación.
- `exportToExcel(filename, sheets)` — soporta múltiples hojas.
- `generateInvoicePdf(invoice, items, company)` — plantilla específica de factura con encabezado de empresa, datos de cliente, líneas, totales, IVA, pie con condiciones.

Todo se genera client-side (sin edge functions ni dependencias de Workers).

## 4. Dashboard real (`app.index.tsx`)

Reemplazar contenido placeholder por KPIs reales con `useQuery`:
- Ventas del mes (total + variación vs mes anterior)
- Órdenes pendientes (count por status)
- Stock crítico (productos con `quantity < min_stock`)
- Cartera vencida (suma de `invoices.balance` con `due_date < now()`)
- Gráfico de ventas últimos 12 meses (reutilizar `recharts` ya disponible en `app.analytics.tsx`).
- 4 cards con accesos rápidos a módulos clave.

## 5. Sidebar y navegación

Añadir en `src/components/app-sidebar.tsx`:
- Grupo **Finanzas**: Facturas, Cuentas por cobrar, Proveedores, Cuentas por pagar.
- Grupo **Reportes**: Centro de reportes.
- Iconos: `FileText`, `Wallet`, `Truck` (ya existe), `Receipt`, `BarChart3`.

## 6. Pulido final

- Loading skeletons consistentes en todas las tablas (componente `<TableSkeleton rows={n} />`).
- Estados vacíos (componente `<EmptyState icon title description action />`).
- Revisión responsive de tablas largas (scroll horizontal en mobile).
- Verificación de que el botón "Atrás" funciona en las rutas nuevas.

## Estructura técnica

```
src/
  routes/
    app.invoices.tsx
    app.invoices.$id.tsx
    app.receivables.tsx
    app.suppliers.tsx
    app.payables.tsx
    app.reports.tsx
    app.index.tsx              (reemplazar placeholder)
  lib/
    export.ts                  (PDF + Excel helpers)
    invoice-pdf.ts             (plantilla factura)
  components/
    table-skeleton.tsx
    empty-state.tsx
    app-sidebar.tsx            (editar)
supabase/migrations/
  <timestamp>_phase5_finance.sql
```

## Fuera de alcance (explícito)

- Facturación electrónica DIAN / integración con proveedor fiscal.
- Envío de notificaciones por email o in-app.
- Conciliación bancaria.

## Orden de ejecución

1. Migración SQL (esperar aprobación).
2. Instalar dependencias `jspdf jspdf-autotable xlsx`.
3. Helpers `src/lib/export.ts` + plantilla de factura.
4. Módulos: suppliers → invoices (+detalle) → payables → receivables → reports.
5. Dashboard real + sidebar.
6. Pulido (skeletons, estados vacíos).
