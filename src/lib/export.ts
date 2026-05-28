import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface CompanyInfo {
  company_name?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  currency?: string | null;
}

export function fmtMoney(n: number, currency = "COP") {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
}

export function exportToPdf(opts: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  company?: CompanyInfo | null;
  filename?: string;
  meta?: Record<string, string>;
}) {
  const { title, columns, rows, company, meta } = opts;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(company?.company_name || "Arepomary", 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let y = 24;
  if (company?.tax_id) { doc.text(`NIT: ${company.tax_id}`, 14, y); y += 4; }
  if (company?.address) { doc.text(company.address, 14, y); y += 4; }
  if (company?.email || company?.phone) {
    doc.text([company?.email, company?.phone].filter(Boolean).join(" · "), 14, y);
    y += 4;
  }

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth - 14, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString("es-CO"), pageWidth - 14, 24, { align: "right" });

  if (meta) {
    let my = y + 2;
    Object.entries(meta).forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, my);
      my += 4;
    });
    y = my;
  }

  autoTable(doc, {
    startY: y + 4,
    head: [columns],
    body: rows.map((r) => r.map((c) => (typeof c === "number" ? String(c) : c ?? ""))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
    margin: { left: 14, right: 14 },
  });

  doc.save(opts.filename || `${title.toLowerCase().replace(/\s+/g, "_")}.pdf`);
}

export function exportToExcel(opts: {
  filename: string;
  sheets: { name: string; columns: string[]; rows: (string | number)[][] }[];
}) {
  const wb = XLSX.utils.book_new();
  for (const sh of opts.sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sh.columns, ...sh.rows]);
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`);
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
}

export function generateInvoicePdf(args: {
  number: number | string;
  issued_at: string;
  due_date?: string | null;
  customer: { name: string; tax_id?: string | null; address?: string | null; phone?: string | null };
  lines: InvoiceLine[];
  tax: number;
  notes?: string | null;
  company: CompanyInfo | null | undefined;
}) {
  const { number, issued_at, due_date, customer, lines, tax, notes, company } = args;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const currency = company?.currency || "COP";

  // Brand
  doc.setFillColor(212, 168, 76);
  doc.rect(0, 0, w, 4, "F");

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(company?.company_name || "Arepomary", 14, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 28;
  if (company?.legal_name) { doc.text(company.legal_name, 14, y); y += 4; }
  if (company?.tax_id) { doc.text(`NIT ${company.tax_id}`, 14, y); y += 4; }
  if (company?.address) { doc.text(company.address, 14, y); y += 4; }
  if (company?.email || company?.phone) {
    doc.text([company?.email, company?.phone].filter(Boolean).join(" · "), 14, y);
    y += 4;
  }

  // Invoice meta box
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", w - 14, 22, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No. ${number}`, w - 14, 28, { align: "right" });
  doc.text(`Fecha: ${issued_at}`, w - 14, 33, { align: "right" });
  if (due_date) doc.text(`Vence: ${due_date}`, w - 14, 38, { align: "right" });

  // Customer block
  const cy = Math.max(y, 45) + 6;
  doc.setDrawColor(220);
  doc.rect(14, cy, w - 28, 22);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("CLIENTE", 17, cy + 5);
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(customer.name, 17, cy + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const cust = [customer.tax_id && `NIT ${customer.tax_id}`, customer.address, customer.phone].filter(Boolean).join(" · ");
  if (cust) doc.text(cust, 17, cy + 17);

  // Items
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const total = subtotal + (tax || 0);

  autoTable(doc, {
    startY: cy + 28,
    head: [["Descripción", "Cant.", "Precio unit.", "Total"]],
    body: lines.map((l) => [
      l.description,
      String(l.quantity),
      fmtMoney(l.unit_price, currency),
      fmtMoney(l.quantity * l.unit_price, currency),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Totals
  const tx = w - 14;
  doc.setFontSize(10);
  doc.text("Subtotal:", tx - 50, afterTable);
  doc.text(fmtMoney(subtotal, currency), tx, afterTable, { align: "right" });
  doc.text("IVA:", tx - 50, afterTable + 6);
  doc.text(fmtMoney(tax || 0, currency), tx, afterTable + 6, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", tx - 50, afterTable + 14);
  doc.text(fmtMoney(total, currency), tx, afterTable + 14, { align: "right" });

  if (notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Notas:", 14, afterTable + 24);
    doc.text(doc.splitTextToSize(notes, w - 28), 14, afterTable + 29);
  }

  doc.save(`factura_${number}.pdf`);
}
