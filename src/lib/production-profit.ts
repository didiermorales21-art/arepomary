export type ProductionProfit = {
  sales: number;
  grossProfit: number;
  grossMargin: number;
  commissions: number;
  netProfit: number;
  netMargin: number;
};

type BatchLike = { product_id?: string | null; produced_quantity?: number | null; total_cost?: number | null };
type SaleItemLike = {
  product_id?: string | null;
  quantity?: number | null;
  line_total?: number | null;
  sales?: {
    status?: string | null;
    customers?: {
      customer_type?: string | null;
      gives_commission?: boolean | null;
      commission_per_package?: number | null;
    } | null;
  } | null;
};

export function allocateProductionProfits(
  batches: BatchLike[],
  saleItems: SaleItemLike[],
  standardRate: number,
  wholesaleRate: number,
): ProductionProfit[] {
  const producedByProduct = new Map<string, number>();
  batches.forEach((batch) => {
    if (!batch.product_id) return;
    producedByProduct.set(batch.product_id, (producedByProduct.get(batch.product_id) ?? 0) + Number(batch.produced_quantity ?? 0));
  });

  const salesByProduct = new Map<string, { sales: number; commissions: number }>();
  saleItems.forEach((item) => {
    if (!item.product_id || item.sales?.status === "cancelled") return;
    const customer = item.sales?.customers;
    const rate = customer?.commission_per_package ?? (customer?.customer_type === "wholesale" ? wholesaleRate : standardRate);
    const current = salesByProduct.get(item.product_id) ?? { sales: 0, commissions: 0 };
    current.sales += Number(item.line_total ?? 0);
    if (customer?.gives_commission !== false) current.commissions += Number(item.quantity ?? 0) * Number(rate ?? 0);
    salesByProduct.set(item.product_id, current);
  });

  return batches.map((batch) => {
    const produced = Number(batch.produced_quantity ?? 0);
    const productTotal = batch.product_id ? producedByProduct.get(batch.product_id) ?? 0 : 0;
    const share = productTotal > 0 ? produced / productTotal : 0;
    const productSales = batch.product_id ? salesByProduct.get(batch.product_id) : undefined;
    const sales = Number(productSales?.sales ?? 0) * share;
    const commissions = Number(productSales?.commissions ?? 0) * share;
    const grossProfit = sales - Number(batch.total_cost ?? 0);
    const netProfit = grossProfit - commissions;
    return {
      sales,
      grossProfit,
      grossMargin: sales > 0 ? (grossProfit / sales) * 100 : 0,
      commissions,
      netProfit,
      netMargin: sales > 0 ? (netProfit / sales) * 100 : 0,
    };
  });
}