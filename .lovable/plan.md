## Objetivo

Actualmente un pedido (orders) y una venta (sales) son entidades separadas y no hay forma de pasar de uno al otro. Propongo agregar un botón **"Convertir en venta"** en la lista de pedidos que cree automáticamente la venta a partir del pedido.

## Cómo funcionará

En la página **Pedidos** (`/app/orders`), cada fila tendrá un botón nuevo "Convertir en venta" disponible cuando el pedido esté en estado `confirmado`, `en producción`, `listo` o `entregado` (no en `borrador` ni `cancelado`).

Al hacer clic:
1. Se crea una venta nueva con el mismo cliente, vendedor y productos (cantidades y precios) del pedido.
2. La venta queda enlazada al pedido original (campo `order_id` en `sales`) para evitar duplicar conversiones.
3. El pedido pasa automáticamente a estado `entregado`.
4. Aparece un toast con el número de la venta creada y un enlace para abrir la sección Ventas.

Si el pedido ya fue convertido antes, el botón se reemplaza por una etiqueta "Venta #N" para indicar que ya existe.

## Cambios técnicos

**Base de datos** (migración):
- Agregar columna `order_id uuid` a `sales` con FK a `orders(id) ON DELETE SET NULL` y un índice único parcial para impedir dos ventas del mismo pedido.
- Función RPC `convert_order_to_sale(_order_id uuid)` con `SECURITY DEFINER` que:
  - Valida que el pedido exista, no esté cancelado y no tenga ya una venta asociada.
  - Inserta la venta copiando `customer_id`, `seller_id`, `notes` y `status='confirmed'`.
  - Copia los `order_items` a `sale_items` (los triggers existentes recalculan totales).
  - Actualiza el pedido a `status='delivered'`.
  - Devuelve el `id` y `sale_number` de la venta creada.
- Permisos: solo `admin`, `operations` o el `seller` dueño del pedido pueden ejecutarla.

**Frontend** (`src/routes/app.orders.tsx`):
- Extender la consulta de pedidos para traer `sales(id, sale_number)` (relación inversa).
- Nueva columna "Venta" en la tabla con el botón o la etiqueta.
- Mutación que llama a `supabase.rpc('convert_order_to_sale', ...)` e invalida `["orders"]` y `["sales"]`.

## Notas

- No se duplica lógica: los triggers de `sale_items` ya recalculan subtotal/total automáticamente.
- La conversión es idempotente gracias al índice único en `sales.order_id`.
- No se modifica la página de Ventas; la venta convertida aparece ahí como cualquier otra.
