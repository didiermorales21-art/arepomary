# SaaS Readiness Assessment

**Product:** Arepomary ERP → Arepomary SaaS  
**Version:** 1.0  
**Date:** June 19, 2026  
**Assessor:** Engineering & Product (based on repository analysis)

---

## 1. Executive Summary

Arepomary ERP is a **feature-rich single-tenant operational platform** with strong domain modeling for food production and delivery. It is **not yet SaaS-ready** but has a solid foundation — particularly in database design, RLS patterns, and business logic encapsulation in PostgreSQL.

**Overall SaaS Readiness Score: 32 / 100**

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Product completeness | 72/100 | 15% | 10.8 |
| Multi-tenancy | 0/100 | 25% | 0.0 |
| Security & compliance | 45/100 | 20% | 9.0 |
| Scalability | 25/100 | 15% | 3.8 |
| Engineering maturity | 20/100 | 10% | 2.0 |
| Billing & commercial | 0/100 | 10% | 2.0 |
| AI readiness | 10/100 | 5% | 0.5 |
| **Total** | | **100%** | **32.1** |

**Verdict:** Proceed with SaaS transformation per 5-phase roadmap. Estimated **15 months** to commercial launch with a team of 2–4 engineers.

---

## 2. Assessment Methodology

Each dimension scored 0–100 against SaaS launch criteria:

| Score | Meaning |
|-------|---------|
| 0–25 | Not started or critical gaps |
| 26–50 | Partial implementation, significant work needed |
| 51–75 | Functional but needs hardening |
| 76–100 | Production-ready for SaaS |

Evidence sourced from repository analysis (June 2026): codebase structure, migrations, routes, integrations, and roadmap.

---

## 3. Dimension Assessments

### 3.1 Product Completeness — 72/100

**What's working well:**

| Area | Evidence | Score |
|------|----------|-------|
| CRM & customers | Full CRUD, seller scoping, document lookup | 90 |
| Orders & sales | Lifecycle, convert-to-sale, payments | 85 |
| Production | Batches, cost allocation, profit view | 80 |
| Inventory | Multi-warehouse, movements, raw materials | 80 |
| Logistics | Shipments, drivers, route exports | 75 |
| Finance | Invoices, bills, cashbox, receivables | 80 |
| Commissions | Summary, pending, batch payment | 75 |
| Public ordering | Guest checkout, delivery days, seller referral | 85 |
| Customer portal | Orders, sales, balance | 70 |
| Reports | PDF/Excel export | 70 |
| Admin | RBAC, users, audit, settings | 65 |

**Gaps:**

| Gap | Impact | Remediation |
|-----|--------|-------------|
| No online payment gateway | Cannot collect payment at checkout | Phase 5 |
| No email/SMS notifications | Manual follow-up required | Phase 5 |
| `production_operator` not in UI RBAC | Role exists in DB but unused | Phase 1 |
| Customer login goes to `/app` not `/portal` | Poor UX for customers | Phase 1 |
| No data import (CSV) | Manual setup for new tenants | Phase 3 |
| Monolithic route files (600+ LOC) | Slow feature development | Phase 1 |

---

### 3.2 Multi-Tenancy — 0/100

**Current state:** Single tenant. No `organization_id` on any table. All data implicitly belongs to Arepomary.

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Organization/tenant entity | ❌ | No `organizations` table |
| Tenant column on business tables | ❌ | 36 tables without org scope |
| Tenant-scoped RLS | ❌ | Policies use global roles only |
| Tenant routing (subdomain) | ❌ | Single domain assumed |
| JWT tenant claim | ❌ | No org in JWT |
| Tenant provisioning | ❌ | Manual setup |
| Per-tenant branding | ❌ | Hardcoded Arepomary assets |
| Per-tenant configuration | 🔄 | `company_settings` exists but single row |
| Multi-org user membership | ❌ | One user = one implicit org |
| Platform super-admin | ❌ | No platform-level admin |

**Blockers for SaaS:** This is the **#1 critical gap**. Nothing can launch commercially without EPIC-006/007/008.

**Estimated effort:** 38 person-weeks (Phase 3)

---

### 3.3 Security & Compliance — 45/100

| Requirement | Status | Score | Evidence |
|-------------|--------|-------|----------|
| Authentication (Supabase Auth) | ✅ | 90 | Email/password, JWT, refresh |
| RLS on business tables | ✅ | 80 | 36 migrations, extensive policies |
| Role-based access (DB) | ✅ | 75 | `has_role()`, `is_staff()` |
| Role-based access (UI) | ✅ | 70 | `src/lib/rbac.ts` |
| Seller data scoping | ✅ | 80 | RLS + `isSellerScoped()` |
| Server function auth | ✅ | 75 | JWT middleware + admin assert |
| Recent security hardening | ✅ | 70 | Migration `20260611232353` |
| Secrets in git | ❌ | 0 | `.env` not gitignored, modified in git |
| Rate limiting | ❌ | 0 | No WAF rules on public endpoints |
| CAPTCHA | ❌ | 0 | Guest order unprotected |
| Cross-tenant isolation | ❌ | N/A | Not applicable yet |
| Security audit | ❌ | 0 | Not performed |
| Privacy policy / ToS | ❌ | 0 | Not in repository |
| Dependency scanning | ❌ | 0 | No CI |
| Audit logging | ✅ | 60 | `audit_logs` table + viewer |
| Anon RPC surface | 🔄 | 40 | Necessary but abuse-prone |

**Critical actions (Phase 1):**
1. Remove secrets from git, rotate keys
2. Rate limit public endpoints
3. Add CAPTCHA to guest checkout
4. CI with dependency scanning

---

### 3.4 Scalability — 25/100

| Requirement | Status | Score | Evidence |
|-------------|--------|-------|----------|
| Pagination on list views | ❌ | 0 | Full table loads |
| Dashboard query optimization | ❌ | 20 | Client-side aggregation |
| Edge caching (public) | ❌ | 0 | Every request hits Supabase |
| Connection pooling | ❌ | 0 | Direct client connections |
| Server-side exports | ❌ | 0 | Client-side jspdf/xlsx |
| Background jobs | ❌ | 0 | No pg_cron or worker cron |
| Load testing | ❌ | 0 | No k6 or equivalent |
| Database indexes | 🔄 | 50 | Some indexes on FK columns |
| Materialized views | ❌ | 0 | None |
| Feature flags | ❌ | 0 | None |

**Risk:** Current architecture handles Arepomary's volume but will degrade at 10× data or 50+ tenants without Phase 2 work.

---

### 3.5 Engineering Maturity — 20/100

| Requirement | Status | Score | Evidence |
|-------------|--------|-------|----------|
| CI/CD pipeline | ❌ | 0 | No `.gitlab-ci.yml` |
| Automated tests | ❌ | 0 | Zero test files found |
| Error monitoring | 🔄 | 30 | `error-capture.ts` exists, no Sentry |
| README / documentation | ❌ | 0 | No README in repository |
| Staging environment | ❌ | 0 | Not configured |
| Service layer | 🔄 | 20 | Only 3 server functions, no services |
| Type safety | 🔄 | 40 | Generated types but 100+ `as any` |
| Code organization | 🔄 | 30 | Monolithic routes, no feature folders |
| Deployment automation | 🔄 | 40 | Wrangler config exists, manual deploy |
| Rollback capability | ❌ | 0 | Not documented |

**Positive signals:**
- Consistent shadcn/ui component library
- Generated Supabase types (~1,900 lines)
- Centralized RBAC module
- SSR error wrapper in `server.ts`

---

### 3.6 Billing & Commercial — 0/100

| Requirement | Status |
|-------------|--------|
| Subscription billing (Stripe) | ❌ |
| Plan tiers defined | 🔄 Proposed in PRD, not implemented |
| Self-service signup | ❌ |
| Trial management | ❌ |
| Usage metering | ❌ |
| Billing portal | ❌ |
| Dunning / failed payment handling | ❌ |
| Invoicing (SaaS, not tenant AR) | ❌ |
| Marketing site | ❌ (landing is product, not SaaS marketing) |
| Legal documents (ToS, Privacy) | ❌ |
| Support tooling | ❌ |
| Status page | ❌ |

**All commercial infrastructure is Phase 5 work**, dependent on multi-tenant completion.

---

### 3.7 AI Readiness — 10/100

| Requirement | Status | Score | Evidence |
|-------------|--------|-------|----------|
| Structured historical data | ✅ | 60 | Orders, sales, production batches |
| Tenant isolation for AI | ❌ | 0 | No tenants yet |
| AI service infrastructure | ❌ | 0 | No AI code |
| Forecasting data pipeline | ❌ | 0 | No scheduled aggregation |
| NL report foundation | 🔄 | 20 | Reports module exists, no AI |
| Usage metering for AI | ❌ | 0 | Not implemented |
| AI governance / audit | ❌ | 0 | Not implemented |

**Advantage:** Rich structured data (orders by zone/day, production batches, inventory levels) is ideal for demand forecasting once multi-tenant isolation exists.

---

## 4. Readiness by Roadmap Phase

| Phase | Readiness Today | Target at Exit | Gap |
|-------|----------------|----------------|-----|
| **Phase 1 — Stabilization** | 15% | 100% | CI, tests, secrets, docs, RBAC fixes |
| **Phase 2 — Scalability** | 5% | 100% | Pagination, caching, jobs, load tests |
| **Phase 3 — Multi-Tenant** | 0% | 100% | Full tenant architecture |
| **Phase 4 — AI** | 5% | 80% | AI service + 2 features |
| **Phase 5 — Commercial** | 0% | 100% | Billing, GTM, legal, support |

---

## 5. Strengths to Leverage

| Strength | SaaS Value |
|----------|------------|
| **Deep domain model** | 36 tables covering full food ops lifecycle — hard to replicate |
| **PostgreSQL business logic** | Triggers, RPCs, RLS — tenant scoping extends naturally |
| **Guest checkout flow** | Unique differentiator vs generic ERPs |
| **Order-to-sale conversion** | Core workflow already built and idempotent |
| **Commission system** | Seller network support rare in SMB ERPs |
| **Colombian localization** | COP, Nequi/Daviplata, neighborhood routing — LATAM moat |
| **Modern stack** | React 19, TanStack, Supabase — attractive to developers |
| **Edge deployment** | Cloudflare Workers — global latency advantage |

---

## 6. Critical Risks

| # | Risk | Severity | Phase | Mitigation |
|---|------|----------|-------|------------|
| R1 | Cross-tenant data leak during RLS rewrite | Critical | 3 | Mandatory test suite + external audit |
| R2 | Secrets exposed in git history | High | 1 | Rotate keys, gitignore, audit history |
| R3 | Lovable codegen overwrites customizations | High | 1 | Decouple from Lovable toolchain |
| R4 | Scope creep in multi-tenant migration | High | 3 | Phased table migration, pilot tenants |
| R5 | No tests → regression during refactor | High | 1 | EPIC-002 before EPIC-003/006 |
| R6 | Stripe unavailable/limited in Colombia | Medium | 5 | Evaluate PayU/Mercado Pago fallback |
| R7 | AI costs exceed subscription revenue | Medium | 4 | Usage caps, caching, tier gating |
| R8 | Single-engineer bus factor | Medium | All | Documentation, pair programming |
| R9 | Supabase vendor lock-in | Low | All | Standard PostgreSQL; migration path exists |
| R10 | Market timing / competitor entry | Medium | 5 | Speed to beta; niche focus on artisan food |

---

## 7. Go / No-Go Criteria

### Go — Proceed with SaaS transformation if:

- [x] Core product features validated by Arepomary daily operations
- [x] Domain model is comprehensive (36 tables, 20+ RPCs)
- [x] Modern, maintainable tech stack
- [x] Clear target market (artisan food + delivery, Colombia/LATAM)
- [ ] Committed engineering resources (≥2 FTE for 15 months)
- [ ] Budget for security audit ($5–15k) and legal ($3–8k)
- [ ] At least 3 design partner businesses identified

### No-Go — Pause if:

- [ ] Arepomary itself is not successfully using the platform daily
- [ ] No design partner interest
- [ ] Engineering resources unavailable for Phase 3 (multi-tenant)
- [ ] Supabase pricing prohibitive at target tenant count

**Current recommendation: GO** — with Phase 1 stabilization as immediate priority.

---

## 8. Readiness Checklist

### Must-Have for SaaS Beta (Phase 3 exit)

- [ ] `organizations` table and tenant-scoped RLS on all tables
- [ ] Subdomain tenant routing functional
- [ ] Automated tenant provisioning (<60s)
- [ ] Cross-tenant isolation test suite passing
- [ ] External security audit passed
- [ ] CI/CD with E2E tests
- [ ] Staging environment operational
- [ ] 3 pilot tenants onboarded
- [ ] Arepomary migrated to tenant model
- [ ] Error monitoring (Sentry) live

### Must-Have for Commercial Launch (Phase 5 exit)

- [ ] All beta criteria above
- [ ] Stripe billing with 3 tiers
- [ ] Self-service signup flow
- [ ] Onboarding wizard (>70% completion)
- [ ] Marketing site live
- [ ] Privacy Policy and Terms of Service published
- [ ] Support tooling integrated
- [ ] 99.5% uptime over 30 days
- [ ] AI forecast feature live (Scale tier)
- [ ] 10 paying tenants
- [ ] MRR ≥ $5,000 USD

---

## 9. Competitive Positioning Assessment

| Competitor | Strength vs Arepomary | Arepomary Advantage |
|------------|----------------------|---------------------|
| **Odoo** | Broad ERP, ecosystem | Domain-specific: guest checkout, delivery zones, production batches |
| **Siigo** | Accounting, Colombia presence | Operations-first, not accounting-first |
| **Excel/WhatsApp** | Free, familiar | Integrated order-to-cash, inventory sync |
| **Custom development** | Tailored | Faster time-to-value, maintained platform |
| **Generic SaaS ERP** | Multi-tenant ready | Deep food production + LATAM delivery |

**Differentiation moat:** Guest ordering + production + neighborhood logistics + seller commissions in one vertical SaaS.

---

## 10. Investment Summary

| Category | Estimated Cost | Timeline |
|----------|---------------|----------|
| Engineering (122 person-weeks @ $80/hr loaded) | ~$390,000 USD | 15 months |
| Security audit | $5,000–15,000 | Phase 3 |
| Legal (ToS, Privacy, DPA) | $3,000–8,000 | Phase 5 |
| Infrastructure (Supabase, CF, Stripe, LLM) | $500–2,000/month | Ongoing |
| Marketing launch | $5,000–15,000 | Phase 5 |
| **Total to launch** | **~$420,000–450,000 USD** | **15 months** |

**Break-even estimate:** 30–35 Growth-tier tenants ($149/mo) ≈ $4,500–5,200 MRR → covers infra; full engineering ROI at 60+ tenants or higher ARPU tiers.

---

## 11. Recommended Immediate Actions (Next 30 Days)

| # | Action | Owner | Phase |
|---|--------|-------|-------|
| 1 | Add `.env` to `.gitignore`, rotate Supabase keys | Engineering | 1 |
| 2 | Set up GitLab CI (lint, build, typecheck) | Engineering | 1 |
| 3 | Write 5 E2E smoke tests (login, guest order, convert) | Engineering | 1 |
| 4 | Fix customer login redirect to `/portal` | Engineering | 1 |
| 5 | Create README with local dev setup | Engineering | 1 |
| 6 | Identify 3 design partner businesses | Product | 3 prep |
| 7 | Decision: Colombia-only vs LATAM launch | Product | 5 prep |
| 8 | Decision: Stay on Lovable vs self-managed | Engineering | 1 |
| 9 | Provision staging Supabase project | DevOps | 1 |
| 10 | Integrate Sentry error monitoring | Engineering | 1 |

---

## 12. Assessment Summary Matrix

| Dimension | Current | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|-----------|---------|---------|---------|---------|---------|---------|
| Product | 72 | 75 | 75 | 80 | 82 | 85 |
| Multi-tenancy | 0 | 0 | 0 | 85 | 90 | 95 |
| Security | 45 | 70 | 75 | 90 | 92 | 95 |
| Scalability | 25 | 30 | 75 | 80 | 82 | 85 |
| Engineering | 20 | 65 | 70 | 75 | 78 | 85 |
| Billing | 0 | 0 | 0 | 0 | 0 | 85 |
| AI | 10 | 10 | 10 | 10 | 60 | 70 |
| **Overall** | **32** | **42** | **52** | **72** | **78** | **90** |

**SaaS launch readiness threshold: ≥85 overall score** — projected achievable at Phase 5 exit (~15 months).

---

*Assessment based on static repository analysis, architecture review, and roadmap planning. Reassess after each phase exit gate.*
