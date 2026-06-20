# Product Requirements Document (PRD)

**Product:** Arepomary SaaS  
**Codename:** Arepomary Core Operations Platform  
**Version:** 1.0  
**Date:** June 19, 2026  
**Owner:** Product  
**Status:** Draft

---

## 1. Executive Summary

Arepomary SaaS is a cloud ERP platform purpose-built for **artisan food producers and distributors** who sell B2C and B2B with last-mile delivery. It unifies customer management, ordering, production, inventory, logistics, invoicing, and commissions in one system — replacing spreadsheets, WhatsApp orders, and disconnected tools.

Today, Arepomary runs as a **single-tenant deployment** (TanStack Start + Supabase + Cloudflare) serving one Colombian arepa business. This PRD defines requirements to evolve it into a **multi-tenant commercial SaaS** while preserving domain depth in food production and neighborhood-based delivery.

**Tagline:** *Sabor que abraza — operations that scale.*

---

## 2. Problem Statement

### 2.1 Market Problem

Small and mid-size food producers in Colombia and LATAM face:

- **Fragmented operations:** Orders via WhatsApp, inventory in Excel, deliveries on paper routes
- **No order-to-cash visibility:** Gap between customer orders, production, delivery, and payment collection
- **Commission complexity:** Seller networks with per-package commissions are hard to track manually
- **Generic ERP mismatch:** Tools like Odoo or Siigo lack neighborhood routing, production batches, and guest checkout flows

### 2.2 Current Product Gap (Single Tenant → SaaS)

| Gap | Impact |
|-----|--------|
| No tenant isolation | Cannot onboard external businesses |
| Client-heavy architecture | Hard to enforce policies at scale |
| No billing/subscription layer | No recurring revenue model |
| Limited observability/tests | Operational risk at scale |
| Colombia-specific seed data | Not configurable for other regions |

---

## 3. Vision & Goals

### 3.1 Vision

Become the **leading operations platform** for artisan food businesses in LATAM — from order intake to delivery and collection — with AI-assisted planning that reduces waste and stockouts.

### 3.2 Product Goals (12–18 months)

| Goal | Target |
|------|--------|
| G1 — Multi-tenant platform | 10+ paying organizations on shared infra |
| G2 — Time-to-value | New tenant operational in <1 hour |
| G3 — Core workflow automation | Order → production → delivery → sale → invoice in one system |
| G4 — AI differentiation | Demand forecast adopted by 30%+ production users |
| G5 — Reliability | 99.5% uptime, zero cross-tenant data incidents |

### 3.3 Non-Goals (v1 SaaS)

- Full accounting / tax filing (SIIGO/Alegra replacement)
- POS / in-store retail
- Marketplace connecting multiple producers to consumers
- Native mobile apps (PWA acceptable)
- International expansion beyond LATAM in v1

---

## 4. Target Users & Personas

### 4.1 Primary Personas

| Persona | Role | Needs |
|---------|------|-------|
| **María — Owner/Admin** | `admin` | Full visibility, team management, financial control, branding |
| **Carlos — Operations Manager** | `operations` | Orders, production, inventory, supplier coordination |
| **Laura — Seller** | `seller` | Own customers, orders, commissions, mobile-friendly CRM |
| **Diego — Logistics Coordinator** | `logistics_operator` | Route planning, shipments, delivery confirmation |
| **Ana — End Customer** | `customer` / guest | Easy ordering, order history, balance visibility |
| **Platform Operator** | Super-admin (future) | Tenant provisioning, billing, support, suspension |

### 4.2 Secondary Personas

| Persona | Role | Needs |
|---------|------|-------|
| **Production staff** | `production_operator` | Batch execution, material consumption |
| **Collaborators/drivers** | `collaborators` | Assigned routes, delivery status |
| **Finance clerk** | `operations` | Invoices, payables, cashbox |

---

## 5. User Journeys

### 5.1 Guest Order (B2C)

1. Customer visits tenant-branded landing or `/order`
2. Browses active products (no login required)
3. Enters document ID → system autocompletes returning customer data
4. Selects neighborhood, delivery date (validated against tenant delivery days)
5. Optionally selects referring seller
6. Submits order via `create_guest_order` RPC
7. Receives confirmation; order appears in tenant ERP

### 5.2 Order-to-Sale (B2B/B2C Operations)

1. Staff confirms order in `/app/orders`
2. Production plans batch if needed
3. Logistics assigns driver and creates shipment
4. On delivery: mark delivered or **Convert to Sale**
5. Sale triggers inventory deduction; invoice and receivables updated
6. Payments recorded in cashbox/receivables

### 5.3 Seller Commission Cycle

1. Seller manages assigned customers
2. Sales generate commission-eligible invoices
3. Admin reviews pending commissions in `/app/sellers`
4. Batch payment via `pay_seller_commissions`
5. Cash outflow recorded; seller sees paid/pending on dashboard

### 5.4 Tenant Onboarding (SaaS — Future)

1. Owner signs up on marketing site, selects plan
2. Stripe checkout completes
3. Organization provisioned with default warehouse, settings, template zones
4. Onboarding wizard: products, team invites, branding
5. Public order page live at `{tenant}.arepomary.com`

---

## 6. Functional Requirements

### 6.1 Public & Customer-Facing

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-P01 | Public product catalog on landing page | P0 | ✅ Implemented |
| FR-P02 | Guest checkout without registration | P0 | ✅ Implemented |
| FR-P03 | Customer lookup by document ID | P0 | ✅ Implemented |
| FR-P04 | Delivery date constrained to configured weekdays | P0 | ✅ Implemented |
| FR-P05 | Seller referral on guest order | P1 | ✅ Implemented |
| FR-P06 | Customer portal (orders, sales, balance) | P0 | ✅ Implemented |
| FR-P07 | Tenant-branded public pages | P1 | ❌ Not implemented |
| FR-P08 | CAPTCHA / abuse protection on guest orders | P1 | ❌ Not implemented |

### 6.2 CRM & Commercial

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-C01 | Customer CRUD with zones/neighborhoods | P0 | ✅ Implemented |
| FR-C02 | Seller-scoped customer visibility | P0 | ✅ Implemented |
| FR-C03 | Product catalog with SKU, pricing, images | P0 | ✅ Implemented |
| FR-C04 | Price history tracking | P2 | ✅ Implemented |
| FR-C05 | Order lifecycle management | P0 | ✅ Implemented |
| FR-C06 | Convert order to sale (idempotent) | P0 | ✅ Implemented |
| FR-C07 | Sales with line items and payments | P0 | ✅ Implemented |
| FR-C08 | Wholesale vs standard customer types + commissions | P1 | ✅ Implemented |

### 6.3 Supply Chain

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-S01 | Production batch planning and completion | P0 | ✅ Implemented |
| FR-S02 | Raw material inventory and movements | P0 | ✅ Implemented |
| FR-S03 | Multi-warehouse finished goods inventory | P0 | ✅ Implemented |
| FR-S04 | Reserved vs available stock display | P0 | ✅ Implemented |
| FR-S05 | Inventory movement audit trail | P0 | ✅ Implemented |
| FR-S06 | Production cost allocation and profit view | P1 | ✅ Implemented |
| FR-S07 | Logistics: shipments, drivers, route exports | P0 | ✅ Implemented |

### 6.4 Finance

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-F01 | Customer invoicing (AR) | P0 | ✅ Implemented |
| FR-F02 | Supplier bills (AP) | P0 | ✅ Implemented |
| FR-F03 | Cashbox inflows/outflows | P0 | ✅ Implemented |
| FR-F04 | Receivables aging view | P0 | ✅ Implemented |
| FR-F05 | Seller commission payment batches | P1 | ✅ Implemented |
| FR-F06 | PDF/Excel report export | P0 | ✅ Implemented |
| FR-F07 | Online payment gateway integration | P2 | ❌ Not implemented |

### 6.5 Administration

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-A01 | Role-based module access (RBAC) | P0 | ✅ Implemented (client-side) |
| FR-A02 | User role assignment | P0 | ✅ Implemented |
| FR-A03 | Admin password/email management via server functions | P0 | ✅ Implemented |
| FR-A04 | Company settings (delivery days, branding) | P0 | ✅ Partial |
| FR-A05 | Audit log viewer | P1 | ✅ Implemented |
| FR-A06 | Analytics dashboard | P1 | ✅ Implemented |
| FR-A07 | Multi-organization user membership | P1 | ❌ Not implemented |
| FR-A08 | Platform super-admin console | P2 | ❌ Not implemented |

### 6.6 SaaS Platform (Future)

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-X01 | Organization (tenant) provisioning | P0 | ❌ Not implemented |
| FR-X02 | Tenant data isolation (RLS) | P0 | ❌ Not implemented |
| FR-X03 | Subscription billing (Stripe) | P0 | ❌ Not implemented |
| FR-X04 | Self-service tenant signup | P0 | ❌ Not implemented |
| FR-X05 | Usage metering (seats, orders, AI) | P1 | ❌ Not implemented |
| FR-X06 | Tenant onboarding wizard | P1 | ❌ Not implemented |
| FR-X07 | Custom domain per tenant | P2 | ❌ Not implemented |
| FR-X08 | SSO (SAML) for Enterprise | P3 | ❌ Not implemented |

### 6.7 AI (Future)

| ID | Requirement | Priority | Current State |
|----|-------------|----------|---------------|
| FR-AI01 | Product demand forecast (weekly) | P1 | ❌ Not implemented |
| FR-AI02 | Production quantity suggestions | P1 | ❌ Not implemented |
| FR-AI03 | Natural language reports | P1 | ❌ Not implemented |
| FR-AI04 | Logistics route grouping suggestions | P2 | ❌ Not implemented |
| FR-AI05 | Receivables risk scoring | P3 | ❌ Not implemented |

---

## 7. Role & Permission Model

### 7.1 Application Roles

| Role | ERP Access | Data Scope |
|------|------------|------------|
| `admin` | All modules | Organization-wide |
| `operations` | Operations + finance (no admin) | Organization-wide |
| `logistics_operator` | Zones, inventory, logistics, reports | Organization-wide |
| `seller` | CRM, orders, sales, receivables, analytics | Own customers only |
| `customer` | Portal only | Own customer record |
| `production_operator` | Production module (planned) | Organization-wide |

### 7.2 Permission Enforcement

- **UI layer:** `src/lib/rbac.ts` — module visibility and route guards
- **Data layer:** Supabase RLS policies — authoritative enforcement
- **Server functions:** Admin-only operations with service role + JWT validation

---

## 8. Pricing & Packaging (Proposed)

| Tier | Target | Includes | Price (indicative) |
|------|--------|----------|-------------------|
| **Starter** | Solo producer, <5 users | CRM, orders, products, guest checkout, portal | $49/mo USD |
| **Growth** | 5–20 users | + production, inventory, logistics, finance, reports | $149/mo USD |
| **Scale** | 20+ users | + AI forecast, NL reports, API access, priority support | $349/mo USD |
| **Enterprise** | Custom | + SSO, custom domain, dedicated DB option, SLA | Custom |

Add-ons: extra seats, AI query packs, order volume overages.

---

## 9. Success Criteria

### 9.1 Launch Criteria (Phase 5)

- [ ] 3 pilot tenants migrated with zero data loss
- [ ] Cross-tenant isolation verified by external security review
- [ ] Stripe billing live with trial → paid conversion
- [ ] Onboarding wizard completion rate >70%
- [ ] Core E2E test suite passing in CI
- [ ] 99.5% uptime over 30-day pre-launch window

### 9.2 Business Success (6 months post-launch)

- 10+ paying tenants (excluding Arepomary)
- Monthly churn <5%
- NPS >40
- LTV:CAC >3

---

## 10. Dependencies & Constraints

| Dependency | Notes |
|------------|-------|
| Supabase | Auth, Postgres, RLS, Storage — core platform dependency |
| Cloudflare Workers | SSR hosting — CPU/time limits apply |
| Stripe | Billing — Colombia availability to validate |
| Lovable toolchain | May regenerate integration files — migration risk |
| Colombian regulatory context | COP, local payment methods (Nequi, Daviplata) |

---

## 11. Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| OQ-01 | Colombia-only launch or LATAM from day one? | Product | Phase 1 |
| OQ-02 | Per-seat vs per-order pricing? | Product | Phase 5 |
| OQ-03 | Stay on shared Supabase vs dedicated projects for Enterprise? | Engineering | Phase 3 |
| OQ-04 | Deprecate Lovable Cloud dependency? | Engineering | Phase 1 |
| OQ-05 | WhatsApp order intake integration priority? | Product | Phase 4+ |

---

## 12. Appendix: Current Module Map

| Module | Route | RBAC Key |
|--------|-------|----------|
| Dashboard | `/app` | `dashboard` |
| Customers | `/app/customers` | `customers` |
| Products | `/app/products` | `products` |
| Orders | `/app/orders` | `orders` |
| Sales | `/app/sales` | `sales` |
| Zones | `/app/zones` | `zones` |
| Production | `/app/production` | `production` |
| Raw Materials | `/app/raw-materials` | `rawMaterials` |
| Warehouses | `/app/warehouses` | `warehouses` |
| Inventory | `/app/inventory` | `inventory` |
| Movements | `/app/movements` | `movements` |
| Logistics | `/app/logistics` | `logistics` |
| Invoices | `/app/invoices` | `invoices` |
| Cashbox | `/app/cashbox` | `cashbox` |
| Costs | `/app/costs` | `costs` |
| Receivables | `/app/receivables` | `receivables` |
| Suppliers | `/app/suppliers` | `suppliers` |
| Payables | `/app/payables` | `payables` |
| Reports | `/app/reports` | `reports` |
| Analytics | `/app/analytics` | `analytics` |
| Users | `/app/users` | `users` |
| Sellers | `/app/sellers` | `sellers` |
| Collaborators | `/app/collaborators` | `collaborators` |
| Audit | `/app/audit` | `audit` |
| Settings | `/app/settings` | `settings` |
