# Feature Catalog

**Product:** Arepomary SaaS  
**Version:** 1.0  
**Date:** June 19, 2026

Features are organized by domain. Status reflects **current repository state** as of June 2026.

**Legend:** ✅ Implemented · 🔄 Partial · ❌ Not Started · 🎯 SaaS Target

---

## 1. Public & Customer Experience

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-PUB-01 | Landing page | Product catalog preview, brand story, CTAs | ✅ | — | All |
| F-PUB-02 | Guest order form | Order without registration; product picker | ✅ | — | All |
| F-PUB-03 | Customer document lookup | Autocomplete returning customer by cédula/NIT | ✅ | — | All |
| F-PUB-04 | Delivery day validation | Calendar constrained to tenant delivery days | ✅ | — | All |
| F-PUB-05 | Seller referral selector | Optional seller assignment on guest order | ✅ | — | All |
| F-PUB-06 | Neighborhood/zone picker | Location selection for delivery routing | ✅ | — | All |
| F-PUB-07 | Customer signup/login | Email/password registration | ✅ | — | All |
| F-PUB-08 | Customer portal | Orders, sales, balance, password change | ✅ | — | All |
| F-PUB-09 | Tenant-branded storefront | Custom logo, colors, domain per tenant | ❌ 🎯 | EPIC-008 | All |
| F-PUB-10 | Order confirmation notifications | Email/SMS on order submit | ❌ 🎯 | EPIC-012 | Growth+ |
| F-PUB-11 | CAPTCHA on guest checkout | Abuse prevention | ❌ 🎯 | EPIC-001 | All |
| F-PUB-12 | Online payment at checkout | Stripe/PayU integration | ❌ 🎯 | EPIC-011 | Growth+ |

---

## 2. CRM & Customer Management

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-CRM-01 | Customer CRUD | Create, edit, deactivate customers | ✅ | — | Starter+ |
| F-CRM-02 | Customer zones & neighborhoods | Geographic segmentation | ✅ | — | Starter+ |
| F-CRM-03 | Seller assignment | Link customer to seller | ✅ | — | Starter+ |
| F-CRM-04 | Customer types | Standard vs wholesale | ✅ | — | Growth+ |
| F-CRM-05 | Commission configuration | Per-customer commission settings | ✅ | — | Growth+ |
| F-CRM-06 | Customer document ID | Unique document for lookup | ✅ | — | Starter+ |
| F-CRM-07 | Portal user linking | Connect auth user to customer record | ✅ | — | Starter+ |
| F-CRM-08 | Seller-scoped visibility | Sellers see only assigned customers | ✅ | — | Starter+ |
| F-CRM-09 | Customer import (CSV) | Bulk customer upload | ❌ 🎯 | EPIC-008 | Growth+ |
| F-CRM-10 | Customer segmentation tags | Custom tags for marketing | ❌ 🎯 | EPIC-012 | Scale+ |

---

## 3. Product Catalog

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-PRD-01 | Product CRUD | SKU, name, description, unit, price | ✅ | — | Starter+ |
| F-PRD-02 | Product images | Upload to Supabase Storage | ✅ | — | Starter+ |
| F-PRD-03 | Active/inactive toggle | Control catalog visibility | ✅ | — | Starter+ |
| F-PRD-04 | Price history | Audit trail of price changes | ✅ | — | Growth+ |
| F-PRD-05 | Product import (CSV) | Bulk product upload | ❌ 🎯 | EPIC-008 | Growth+ |
| F-PRD-06 | Product variants | Size/flavor variants | ❌ 🎯 | — | Scale+ |

---

## 4. Orders

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-ORD-01 | Order CRUD | Create, edit orders with line items | ✅ | — | Starter+ |
| F-ORD-02 | Order status lifecycle | draft → confirmed → delivered → cancelled | ✅ | — | Starter+ |
| F-ORD-03 | Order status tabs | Filter by status | ✅ | — | Starter+ |
| F-ORD-04 | Delivery date assignment | Per-order delivery scheduling | ✅ | — | Starter+ |
| F-ORD-05 | Convert order to sale | Idempotent RPC conversion | ✅ | — | Starter+ |
| F-ORD-06 | Seller-scoped orders | Sellers see own orders | ✅ | — | Starter+ |
| F-ORD-07 | Order item expansion | Toggle line item detail in table | ✅ | — | Starter+ |
| F-ORD-08 | Order pagination | Cursor-based list pagination | ❌ 🎯 | EPIC-004 | All |
| F-ORD-09 | Order notifications | Status change alerts to customer | ❌ 🎯 | EPIC-012 | Growth+ |
| F-ORD-10 | WhatsApp order intake | Parse WhatsApp messages into orders | ❌ 🎯 | — | Scale+ |

---

## 5. Sales & Payments

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-SAL-01 | Sale CRUD | Sales with line items | ✅ | — | Starter+ |
| F-SAL-02 | Sale status management | draft → confirmed → paid → cancelled | ✅ | — | Starter+ |
| F-SAL-03 | Payment recording | Cash, transfer, Nequi, Daviplata, etc. | ✅ | — | Starter+ |
| F-SAL-04 | Auto-calculated totals | Triggers recalc subtotal/tax/total | ✅ | — | Starter+ |
| F-SAL-05 | Balance tracking | Generated column: total - paid | ✅ | — | Starter+ |
| F-SAL-06 | Order linkage | Sale linked to originating order | ✅ | — | Starter+ |
| F-SAL-07 | Seller-scoped sales | Sellers see own sales | ✅ | — | Starter+ |
| F-SAL-08 | Sale pagination | Cursor-based list pagination | ❌ 🎯 | EPIC-004 | All |

---

## 6. Production

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-PRO-01 | Production batch CRUD | Plan and track batches | ✅ | — | Growth+ |
| F-PRO-02 | Batch status lifecycle | planned → in_progress → completed | ✅ | — | Growth+ |
| F-PRO-03 | Cost allocation | Variable input, labor, fixed costs | ✅ | — | Growth+ |
| F-PRO-04 | Production profit view | Gross/net margin per batch | ✅ | — | Growth+ |
| F-PRO-05 | Raw material consumption | Auto-deduct on batch completion | ✅ | — | Growth+ |
| F-PRO-06 | Finished goods inventory update | Auto-add on batch completion | ✅ | — | Growth+ |
| F-PRO-07 | Production operator role | Dedicated production access | 🔄 | EPIC-003 | Growth+ |
| F-PRO-08 | AI demand forecast | Weekly product demand prediction | ❌ 🎯 | EPIC-009 | Scale+ |
| F-PRO-09 | AI production suggestions | Recommended batch quantities | ❌ 🎯 | EPIC-009 | Scale+ |

---

## 7. Inventory & Supply Chain

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-INV-01 | Multi-warehouse inventory | Stock per product per warehouse | ✅ | — | Growth+ |
| F-INV-02 | Real/reserved/available stock | Three-tier stock display | ✅ | — | Growth+ |
| F-INV-03 | Min/max stock thresholds | Low stock indicators | ✅ | — | Growth+ |
| F-INV-04 | Inventory movements | Full movement audit trail | ✅ | — | Growth+ |
| F-INV-05 | Raw material management | RM stock and movements | ✅ | — | Growth+ |
| F-INV-06 | Raw material purchase | Purchase via cashbox RPC | ✅ | — | Growth+ |
| F-INV-07 | Warehouse CRUD | Warehouse management | ✅ | — | Growth+ |
| F-INV-08 | Low stock alerts | Scheduled notification job | ❌ 🎯 | EPIC-005 | Growth+ |
| F-INV-09 | Inter-warehouse transfer | Transfer stock between warehouses | 🔄 | — | Growth+ |

---

## 8. Logistics

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-LOG-01 | Shipment management | Create and manage delivery shipments | ✅ | — | Growth+ |
| F-LOG-02 | Driver assignment | Assign collaborators as drivers | ✅ | — | Growth+ |
| F-LOG-03 | Order status in shipment | Update order status from logistics | ✅ | — | Growth+ |
| F-LOG-04 | Route sheet export | PDF/Excel route documents | ✅ | — | Growth+ |
| F-LOG-05 | Zone priority routing | Neighborhood priority for grouping | ✅ | — | Growth+ |
| F-LOG-06 | Delivery confirmation | Mark orders delivered | ✅ | — | Growth+ |
| F-LOG-07 | AI route grouping | Suggested shipment groupings | ❌ 🎯 | EPIC-010 | Scale+ |
| F-LOG-08 | Driver mobile view | PWA for driver delivery list | ❌ 🎯 | EPIC-012 | Growth+ |

---

## 9. Finance

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-FIN-01 | Customer invoicing (AR) | Invoice CRUD with line items | ✅ | — | Growth+ |
| F-FIN-02 | Invoice payments | Record payments against invoices | ✅ | — | Growth+ |
| F-FIN-03 | Supplier management | Supplier master data | ✅ | — | Growth+ |
| F-FIN-04 | Bills (AP) | Supplier bill CRUD | ✅ | — | Growth+ |
| F-FIN-05 | Bill payments | Record payments against bills | ✅ | — | Growth+ |
| F-FIN-06 | Cashbox | Cash inflows and outflows | ✅ | — | Growth+ |
| F-FIN-07 | Receivables view | Outstanding customer balances | ✅ | — | Growth+ |
| F-FIN-08 | Cost item configuration | Variable/fixed cost categories | ✅ | — | Growth+ |
| F-FIN-09 | PDF/Excel reports | Export sales, inventory, production | ✅ | — | Growth+ |
| F-FIN-10 | Overdue invoice alerts | Scheduled detection job | ❌ 🎯 | EPIC-005 | Growth+ |
| F-FIN-11 | AI receivables risk scoring | Payment risk per customer | ❌ 🎯 | EPIC-010 | Scale+ |

---

## 10. Commissions

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-COM-01 | Seller commission summary | Aggregate commission view | ✅ | — | Growth+ |
| F-COM-02 | Pending commission invoices | Per-seller pending list | ✅ | — | Growth+ |
| F-COM-03 | Batch commission payment | Pay multiple commissions at once | ✅ | — | Growth+ |
| F-COM-04 | Commission on dashboard | Seller sees paid/pending on home | ✅ | — | Growth+ |
| F-COM-05 | Collaborator commissions | Non-seller commission recipients | ✅ | — | Growth+ |

---

## 11. Administration & Platform

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-ADM-01 | Role-based module access | RBAC via `src/lib/rbac.ts` | ✅ | — | All |
| F-ADM-02 | User role management | Assign/remove roles | ✅ | — | All |
| F-ADM-03 | Admin password reset | Server function with service role | ✅ | — | All |
| F-ADM-04 | Admin email update | Server function with service role | ✅ | — | All |
| F-ADM-05 | Company settings | Delivery days, company info | ✅ | — | All |
| F-ADM-06 | Audit log viewer | Searchable audit trail | ✅ | — | Scale+ |
| F-ADM-07 | Analytics dashboard | Extended metrics and charts | ✅ | — | Growth+ |
| F-ADM-08 | Zone/neighborhood management | CRUD with priority | ✅ | — | Growth+ |
| F-ADM-09 | Collaborator management | Drivers, production staff | ✅ | — | Growth+ |
| F-ADM-10 | Dashboard KPIs | Customers, sales, receivables, chart | ✅ | — | All |

---

## 12. SaaS Platform (Target)

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-SAA-01 | Organization provisioning | Auto-create tenant on signup | ❌ 🎯 | EPIC-008 | Platform |
| F-SAA-02 | Tenant data isolation | RLS with organization_id | ❌ 🎯 | EPIC-006 | Platform |
| F-SAA-03 | Subdomain routing | `{slug}.arepomary.com` | ❌ 🎯 | EPIC-007 | Platform |
| F-SAA-04 | Multi-org user membership | User in multiple tenants | ❌ 🎯 | EPIC-007 | Platform |
| F-SAA-05 | Stripe subscription billing | Plans, trials, dunning | ❌ 🎯 | EPIC-011 | Platform |
| F-SAA-06 | Self-service signup | Marketing → plan → provision | ❌ 🎯 | EPIC-011 | Platform |
| F-SAA-07 | Onboarding wizard | Guided tenant setup | ❌ 🎯 | EPIC-008 | Platform |
| F-SAA-08 | Usage metering | Track seats, orders, AI queries | ❌ 🎯 | EPIC-011 | Platform |
| F-SAA-09 | Platform super-admin | Suspend, metrics, support | ❌ 🎯 | EPIC-007 | Platform |
| F-SAA-10 | Custom domain (Enterprise) | `erp.client.com` | ❌ 🎯 | EPIC-012 | Enterprise |
| F-SAA-11 | SSO / SAML (Enterprise) | Enterprise identity provider | ❌ 🎯 | EPIC-012 | Enterprise |
| F-SAA-12 | Industry templates | Seed data per vertical | ❌ 🎯 | EPIC-008 | Growth+ |

---

## 13. AI (Target)

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-AI-01 | Demand forecast | Weekly product demand prediction | ❌ 🎯 | EPIC-009 | Scale+ |
| F-AI-02 | Production suggestions | Recommended batch quantities | ❌ 🎯 | EPIC-009 | Scale+ |
| F-AI-03 | Natural language reports | Chat-based report queries | ❌ 🎯 | EPIC-010 | Scale+ |
| F-AI-04 | Route grouping assist | Logistics shipment suggestions | ❌ 🎯 | EPIC-010 | Scale+ |
| F-AI-05 | Anomaly detection | Unusual inventory/payment patterns | ❌ 🎯 | — | Enterprise |
| F-AI-06 | AI usage dashboard | Tenant AI consumption metrics | ❌ 🎯 | EPIC-009 | Scale+ |

---

## 14. Engineering Platform (Target)

| ID | Feature | Description | Status | Epic | Tier |
|----|---------|-------------|--------|------|------|
| F-ENG-01 | CI/CD pipeline | Lint, test, build, deploy | ❌ 🎯 | EPIC-001 | Internal |
| F-ENG-02 | Automated test suite | Unit + E2E + RLS tests | ❌ 🎯 | EPIC-002 | Internal |
| F-ENG-03 | Error monitoring (Sentry) | Client + SSR error tracking | ❌ 🎯 | EPIC-001 | Internal |
| F-ENG-04 | Feature flags | Gradual rollout control | ❌ 🎯 | EPIC-005 | Internal |
| F-ENG-05 | Service layer abstraction | Typed Supabase wrappers | 🔄 | EPIC-003 | Internal |
| F-ENG-06 | Rate limiting | Public endpoint protection | ❌ 🎯 | EPIC-001 | Internal |
| F-ENG-07 | Staging environment | Pre-production validation | ❌ 🎯 | EPIC-001 | Internal |

---

## Feature Summary by Status

| Status | Count | % |
|--------|-------|---|
| ✅ Implemented | 62 | 52% |
| 🔄 Partial | 3 | 3% |
| ❌ Not Started (incl. SaaS/AI targets) | 55 | 45% |
| **Total** | **120** | 100% |

## Feature Summary by Tier

| Tier | Features Available |
|------|-------------------|
| **Starter** | Public ordering, CRM, orders, sales, portal, basic admin |
| **Growth** | + production, inventory, logistics, finance, commissions, reports |
| **Scale** | + AI forecast, NL reports, analytics, audit, API access |
| **Enterprise** | + SSO, custom domain, dedicated DB, SLA, anomaly detection |
