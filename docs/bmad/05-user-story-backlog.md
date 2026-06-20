# User Story Backlog

**Product:** Arepomary SaaS  
**Version:** 1.0  
**Date:** June 19, 2026  
**Format:** INVEST-compliant user stories with acceptance criteria  
**Estimation:** Story points (Fibonacci: 1, 2, 3, 5, 8, 13)

---

## Backlog Conventions

| Field | Description |
|-------|-------------|
| **ID** | `US-{EPIC}-{NNN}` |
| **Priority** | P0 (must) · P1 (should) · P2 (could) |
| **Status** | Done · In Progress · Backlog |
| **SP** | Story points |

---

## EPIC-001: Platform Stabilization & Security

### US-001-001 · Secrets hygiene
**As a** platform operator  
**I want** secrets excluded from version control and stored in Cloudflare/Supabase vault  
**So that** API keys cannot be leaked via git

**Priority:** P0 · **SP:** 2 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `.env` added to `.gitignore`
- [ ] `.env.example` documents all required variables without values
- [ ] Supabase and Cloudflare secrets rotated post-remediation
- [ ] Documentation updated with secret management runbook

---

### US-001-002 · CI pipeline
**As a** developer  
**I want** automated lint, typecheck, and build on every merge request  
**So that** broken code cannot reach production

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] GitLab CI runs `eslint`, `tsc --noEmit`, `vite build`
- [ ] Pipeline completes in <10 minutes
- [ ] Failed pipeline blocks merge
- [ ] Migration SQL linting validates syntax

---

### US-001-003 · Error monitoring
**As a** platform operator  
**I want** client and SSR errors captured in Sentry  
**So that** I can diagnose production issues proactively

**Priority:** P0 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Sentry SDK integrated in client and `src/server.ts`
- [ ] Errors include user ID and route context (no PII)
- [ ] Alert rule for error rate spike
- [ ] Source maps uploaded for readable stack traces

---

### US-001-004 · Public endpoint rate limiting
**As a** platform operator  
**I want** rate limits on guest order and customer lookup endpoints  
**So that** the system cannot be abused for spam or enumeration

**Priority:** P1 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Cloudflare WAF rule limits `/order` submissions to 10/min/IP
- [ ] `lookup_customer_by_document` limited to 20/min/IP
- [ ] 429 response with retry-after header
- [ ] Rate limit events logged

---

### US-001-005 · CAPTCHA on guest checkout
**As a** platform operator  
**I want** CAPTCHA verification on guest order submission  
**So that** automated bot orders are prevented

**Priority:** P1 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] CAPTCHA displayed before order submit
- [ ] Server-side validation of CAPTCHA token
- [ ] Failed CAPTCHA shows user-friendly error
- [ ] CAPTCHA skipped in E2E test environment

---

### US-001-006 · Staging environment
**As a** developer  
**I want** a staging environment mirroring production  
**So that** changes can be validated before release

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Staging Supabase project provisioned
- [ ] Staging Cloudflare Worker deployed on preview URL
- [ ] Seed data script populates realistic test data
- [ ] Staging secrets separate from production

---

## EPIC-002: Quality Engineering Foundation

### US-002-001 · RBAC unit tests
**As a** developer  
**I want** unit tests for all RBAC functions  
**So that** permission changes don't break access control

**Priority:** P0 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Tests for `modulesForRoles()` all role combinations
- [ ] Tests for `canAccessPath()` including nested paths
- [ ] Tests for `isSellerScoped()` edge cases
- [ ] 100% coverage on `src/lib/rbac.ts`

---

### US-002-002 · E2E login flow
**As a** QA engineer  
**I want** an E2E test for staff login  
**So that** authentication regressions are caught automatically

**Priority:** P0 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Playwright test: login → dashboard visible
- [ ] Test validates role-appropriate sidebar items
- [ ] Test runs in CI against staging
- [ ] Test completes in <30 seconds

---

### US-002-003 · E2E guest order flow
**As a** QA engineer  
**I want** an E2E test for guest checkout  
**So that** the primary revenue path is protected

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Playwright test: select product → fill form → submit → confirmation
- [ ] Order appears in ERP orders list
- [ ] Test uses unique document ID per run
- [ ] CAPTCHA bypassed in test env

---

### US-002-004 · E2E order-to-sale conversion
**As a** QA engineer  
**I want** an E2E test for order → sale conversion  
**So that** the core operational workflow is verified

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Create order as admin → convert to sale → verify sale record
- [ ] Order status updated to `delivered`
- [ ] Duplicate conversion prevented (idempotency)
- [ ] Sale appears in sales list with correct totals

---

### US-002-005 · RLS integration tests
**As a** developer  
**I want** automated tests verifying RLS policies  
**So that** data isolation is proven before SaaS launch

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Tests for admin, seller, customer, anon, operations roles
- [ ] Seller cannot read other seller's customers
- [ ] Customer can only read own portal data
- [ ] Anon can only call allowed RPCs
- [ ] Tests run against local Supabase via CLI

---

### US-002-006 · RPC contract tests
**As a** developer  
**I want** tests for critical RPC function contracts  
**So that** database function changes don't break the frontend

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Tests for `create_guest_order` input/output shape
- [ ] Tests for `convert_order_to_sale` idempotency
- [ ] Tests for `pay_seller_commissions` balance updates
- [ ] Tests for `lookup_customer_by_document` response format

---

## EPIC-003: Codebase Modernization

### US-003-001 · Orders service layer
**As a** developer  
**I want** a typed orders service module  
**So that** order logic is reusable and testable

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `src/services/orders.service.ts` with typed CRUD + RPC wrappers
- [ ] `app.orders.tsx` refactored to use service (≤300 LOC)
- [ ] No `as any` on order RPC calls
- [ ] Unit tests for service functions

---

### US-003-002 · Sales service layer
**As a** developer  
**I want** a typed sales service module  
**So that** sales logic is centralized

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `src/services/sales.service.ts` created
- [ ] `app.sales.tsx` refactored to use service
- [ ] Payment recording via typed wrapper

---

### US-003-003 · Production operator role
**As a** production manager  
**I want** the production_operator role available in the UI  
**So that** production staff can access only their module

**Priority:** P1 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `production_operator` added to `AppRole` type
- [ ] `ROLE_ACCESS` maps to production, inventory, raw-materials modules
- [ ] Sidebar shows only permitted modules
- [ ] RLS policies verified for this role

---

### US-003-004 · Customer login redirect
**As a** registered customer  
**I want** to be redirected to my portal after login  
**So that** I don't see an ERP access denied screen

**Priority:** P0 · **SP:** 2 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Login with `customer` role redirects to `/portal`
- [ ] Signup redirects to `/portal`
- [ ] Staff roles still redirect to `/app`
- [ ] Landing page redirects authenticated customers to `/portal`

---

### US-003-005 · Developer documentation
**As a** new developer  
**I want** a README with setup instructions  
**So that** I can run the project locally in <30 minutes

**Priority:** P1 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] README with prerequisites, install, env setup, dev commands
- [ ] RPC catalog document listing all database functions
- [ ] Role matrix document
- [ ] Architecture diagram linked

---

## EPIC-004: Performance & Scalability

### US-004-001 · Orders pagination
**As an** operations manager  
**I want** paginated order lists  
**So that** the page loads quickly even with thousands of orders

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Cursor-based pagination (50 rows default)
- [ ] Previous/next navigation controls
- [ ] Total count displayed
- [ ] Filters work with pagination
- [ ] p95 load <1s with 10k orders

---

### US-004-002 · Dashboard materialized views
**As an** admin  
**I want** the dashboard to load quickly regardless of data volume  
**So that** I can monitor KPIs without waiting

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Materialized view for monthly sales aggregation
- [ ] View refreshed hourly via pg_cron
- [ ] Dashboard queries view instead of raw sales table
- [ ] p95 dashboard load <2s with 100k sales

---

### US-004-003 · Public catalog edge cache
**As a** guest customer  
**I want** the product catalog to load instantly  
**So that** my ordering experience is smooth

**Priority:** P1 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Cloudflare cache rule for product catalog API responses
- [ ] TTL configurable (default 5 min)
- [ ] Cache invalidated on product update
- [ ] Cache hit ratio >80% in production

---

### US-004-004 · Server-side report export
**As an** operations manager  
**I want** large reports generated server-side  
**So that** browser doesn't crash on big datasets

**Priority:** P1 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Reports >1000 rows generated via server function
- [ ] PDF and Excel formats supported
- [ ] Progress indicator for long exports
- [ ] Download link expires after 1 hour

---

### US-004-005 · Load testing baseline
**As a** platform operator  
**I want** a load test baseline  
**So that** I know the system's capacity limits

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] k6 script simulating 100 concurrent ERP users
- [ ] Test covers login, dashboard, order list, order create
- [ ] Results documented with p50/p95/p99 latency
- [ ] Bottlenecks identified and remediated

---

## EPIC-005: Background Operations

### US-005-001 · Low stock alerts
**As an** operations manager  
**I want** automatic low stock notifications  
**So that** I can reorder before stockouts

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Daily job checks inventory vs min_stock
- [ ] In-app notification for items below minimum
- [ ] Notification visible on dashboard and inventory page
- [ ] Configurable per product/warehouse

---

### US-005-002 · Overdue invoice detection
**As a** finance clerk  
**I want** automatic overdue invoice flagging  
**So that** I can follow up on late payments

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Daily job marks invoices past due_date as `overdue`
- [ ] Overdue count visible on dashboard receivables KPI
- [ ] Receivables page highlights overdue items

---

## EPIC-006: Multi-Tenant Data Model

### US-006-001 · Organizations table
**As a** platform architect  
**I want** an organizations table as the tenant root entity  
**So that** all business data can be scoped to a tenant

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `organizations` table with id, slug, name, plan, status, settings
- [ ] `organization_members` linking users to orgs with roles
- [ ] Migration script tested on staging
- [ ] Unique slug constraint enforced

---

### US-006-002 · Tenant column migration
**As a** platform architect  
**I want** `organization_id` on all business tables  
**So that** every record belongs to exactly one tenant

**Priority:** P0 · **SP:** 13 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `organization_id NOT NULL` on all 30+ business tables
- [ ] FK constraint to organizations(id)
- [ ] Index on organization_id for all tables
- [ ] Existing Arepomary data assigned to default org

---

### US-006-003 · Tenant-scoped RLS rewrite
**As a** security engineer  
**I want** all RLS policies scoped by organization_id  
**So that** cross-tenant data access is impossible

**Priority:** P0 · **SP:** 13 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Every SELECT/INSERT/UPDATE/DELETE policy includes org check
- [ ] `has_role()` updated to accept organization context
- [ ] Automated test suite proves zero cross-tenant access
- [ ] External security audit passed

---

### US-006-004 · Tenant-aware RPC refactor
**As a** developer  
**I want** all RPC functions to enforce tenant scope  
**So that** business logic cannot leak across tenants

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] All SECURITY DEFINER functions validate organization_id
- [ ] `create_guest_order` scoped to tenant subdomain
- [ ] `convert_order_to_sale` validates org ownership
- [ ] RPC tests verify tenant isolation

---

## EPIC-007: Tenant Identity & Routing

### US-007-001 · Subdomain tenant resolution
**As a** tenant owner  
**I want** my business accessible at `{slug}.arepomary.com`  
**So that** my team and customers have a branded URL

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Wildcard DNS `*.arepomary.com` configured
- [ ] Middleware extracts slug from hostname
- [ ] Invalid slug shows "organization not found" page
- [ ] Tenant context available in all routes

---

### US-007-002 · JWT organization claim
**As a** developer  
**I want** the JWT to include organization_id  
**So that** Supabase RLS can enforce tenant scope automatically

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `app_metadata.organization_id` set on login
- [ ] RLS helper `current_org_id()` reads from JWT
- [ ] Token refresh preserves org claim
- [ ] Switching org issues new token

---

### US-007-003 · Organization switcher
**As a** user in multiple organizations  
**I want** to switch between my organizations  
**So that** I can manage different businesses from one account

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Switcher dropdown in ERP header
- [ ] Switching reloads data for selected org
- [ ] JWT updated with new org claim
- [ ] Last-selected org persisted in localStorage

---

### US-007-004 · Platform super-admin console
**As a** platform operator  
**I want** a super-admin view of all tenants  
**So that** I can manage the SaaS platform

**Priority:** P1 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] List all organizations with status, plan, user count
- [ ] Suspend/activate tenant (blocks all access)
- [ ] View tenant usage metrics
- [ ] Accessible only to platform super-admin role

---

## EPIC-008: Tenant Provisioning & White-Label

### US-008-001 · Automated tenant provisioning
**As a** new tenant owner  
**I want** my organization created automatically on signup  
**So that** I can start using the platform immediately

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Provisioning creates org + default warehouse + settings + admin role
- [ ] Completes in <60 seconds
- [ ] Idempotent (retry-safe)
- [ ] Rollback on partial failure

---

### US-008-002 · Tenant branding
**As a** tenant owner  
**I want** to customize my logo and brand colors  
**So that** my customers see my brand, not Arepomary's

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Logo upload in settings
- [ ] Primary/accent color pickers
- [ ] Branding applied on landing, order, portal pages
- [ ] ERP sidebar shows tenant logo

---

### US-008-003 · Industry template seed
**As a** new tenant owner  
**I want** starter data for my industry  
**So that** I don't start from a blank slate

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] "Food production & delivery" template available
- [ ] Seeds: sample products, cost categories, warehouse
- [ ] Optional: sample zones/neighborhoods structure (empty, not hardcoded)
- [ ] Template selectable during onboarding

---

### US-008-004 · Onboarding wizard
**As a** new tenant owner  
**I want** a guided setup wizard  
**So that** my business is operational within an hour

**Priority:** P1 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Steps: company info → products → team invites → branding → go live
- [ ] Progress indicator with skip option
- [ ] Completion tracked (target >70% finish rate)
- [ ] Public order page link shown at end

---

## EPIC-009: AI Demand & Production Intelligence

### US-009-001 · Demand forecast display
**As a** production manager  
**I want** to see predicted demand for each product next week  
**So that** I can plan production quantities accurately

**Priority:** P1 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Forecast widget on dashboard and production page
- [ ] Shows predicted units per product for next 7 days
- [ ] Confidence interval displayed
- [ ] Refreshed daily via scheduled job
- [ ] Labelled as "suggestion" not guarantee

---

### US-009-002 · Production quantity suggestions
**As a** production manager  
**I want** recommended batch quantities based on forecast and current stock  
**So that** I reduce waste and stockouts

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Suggestion shown when creating new batch
- [ ] Formula: forecast - available stock + safety buffer
- [ ] One-click to accept suggestion as planned quantity
- [ ] Suggestion explains its reasoning

---

### US-009-003 · AI service tenant isolation
**As a** platform operator  
**I want** AI queries strictly scoped to the requesting tenant  
**So that** no cross-tenant data reaches the LLM

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] AI service validates organization_id before any query
- [ ] Read-only DB role scoped to tenant
- [ ] Audit log of all AI queries with org_id
- [ ] Pen test confirms no cross-tenant leakage

---

## EPIC-010: AI Reporting & Logistics Assist

### US-010-001 · Natural language reports
**As an** admin  
**I want** to ask questions about my data in plain Spanish  
**So that** I get insights without building custom reports

**Priority:** P1 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Chat panel in `/app/reports`
- [ ] Supports: "Ventas por zona esta semana", "Productos más vendidos", "Clientes con saldo pendiente"
- [ ] Results displayed as table with export option
- [ ] Guardrailed: allowlisted tables only, read-only queries
- [ ] Query logged in audit trail

---

### US-010-002 · Logistics route grouping
**As a** logistics coordinator  
**I want** suggested shipment groupings based on zones and priorities  
**So that** I spend less time manually organizing deliveries

**Priority:** P2 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] "Suggest groupings" button on logistics page
- [ ] Groups orders by zone priority and delivery date
- [ ] One-click to create shipments from suggestions
- [ ] User can modify before confirming

---

## EPIC-011: Commercial Billing & Self-Service

### US-011-001 · Stripe subscription setup
**As a** platform operator  
**I want** Stripe products and prices configured for three tiers  
**So that** tenants can subscribe and pay automatically

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Starter, Growth, Scale products in Stripe
- [ ] Monthly and annual pricing options
- [ ] 14-day trial configured
- [ ] Webhook endpoint registered and verified

---

### US-011-002 · Self-service signup flow
**As a** prospective tenant owner  
**I want** to sign up, select a plan, and pay online  
**So that** I can start using the platform without sales contact

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Marketing site → plan selection → Stripe checkout → provisioning
- [ ] Trial starts immediately; payment after trial
- [ ] Confirmation email sent (via Supabase Auth or Stripe)
- [ ] Redirect to onboarding wizard on success

---

### US-011-003 · Subscription lifecycle management
**As a** platform operator  
**I want** automated handling of subscription events  
**So that** tenant access reflects payment status

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] `subscription.created` → activate tenant
- [ ] `invoice.payment_failed` → grace period (7 days) then suspend
- [ ] `subscription.deleted` → suspend tenant
- [ ] Tenant owner notified of payment issues

---

### US-011-004 · Billing portal
**As a** tenant owner  
**I want** to manage my subscription from the ERP  
**So that** I can upgrade, downgrade, or cancel without contacting support

**Priority:** P1 · **SP:** 3 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] "Manage billing" link in settings
- [ ] Redirects to Stripe Customer Portal
- [ ] Current plan and usage displayed in settings
- [ ] Upgrade/downgrade reflected within 5 minutes

---

## EPIC-012: Go-to-Market & Launch

### US-012-001 · Product marketing site
**As a** prospective customer  
**I want** a marketing site explaining the product and pricing  
**So that** I can evaluate and sign up

**Priority:** P0 · **SP:** 8 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Landing page with value proposition, features, pricing
- [ ] Arepomary case study section
- [ ] CTA to signup/trial on every page
- [ ] Mobile responsive
- [ ] SEO meta tags configured

---

### US-012-002 · Beta program
**As a** product manager  
**I want** 5 design partner tenants onboarded before public launch  
**So that** we validate the product with real businesses

**Priority:** P0 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] 5 beta tenants identified and onboarded
- [ ] Feedback collected via structured interviews
- [ ] Critical feedback incorporated before launch
- [ ] Beta terms documented (free/discounted, no SLA)

---

### US-012-003 · Support infrastructure
**As a** tenant user  
**I want** in-app help and support contact  
**So that** I can get assistance when stuck

**Priority:** P1 · **SP:** 5 · **Status:** Backlog

**Acceptance Criteria:**
- [ ] Help icon linking to documentation
- [ ] Support chat widget (Intercom/Crisp) integrated
- [ ] Support SLA documented per tier
- [ ] Status page for platform uptime

---

## Backlog Summary

| Epic | Stories | Total SP | P0 | P1 | P2 |
|------|---------|----------|----|----|-----|
| EPIC-001 | 6 | 21 | 4 | 2 | 0 |
| EPIC-002 | 6 | 29 | 5 | 1 | 0 |
| EPIC-003 | 5 | 18 | 1 | 4 | 0 |
| EPIC-004 | 5 | 29 | 2 | 3 | 0 |
| EPIC-005 | 2 | 10 | 0 | 2 | 0 |
| EPIC-006 | 4 | 39 | 4 | 0 | 0 |
| EPIC-007 | 4 | 26 | 2 | 2 | 0 |
| EPIC-008 | 4 | 26 | 2 | 2 | 0 |
| EPIC-009 | 3 | 18 | 1 | 2 | 0 |
| EPIC-010 | 2 | 13 | 0 | 1 | 1 |
| EPIC-011 | 4 | 21 | 3 | 1 | 0 |
| EPIC-012 | 3 | 18 | 2 | 1 | 0 |
| **Total** | **48** | **268** | **26** | **21** | **1** |

**Velocity assumption:** Team of 2 engineers at ~20 SP/sprint (2-week sprints) → ~27 sprints (~13 months).
