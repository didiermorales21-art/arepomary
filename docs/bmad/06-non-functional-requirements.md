# Non-Functional Requirements (NFR)

**Product:** Arepomary SaaS  
**Version:** 1.0  
**Date:** June 19, 2026

---

## 1. Overview

Non-functional requirements define **how** the system performs, not **what** it does. They apply across all phases and are verified through testing, monitoring, and audits.

**Priority levels:** P0 (launch blocker) · P1 (required for GA) · P2 (post-launch)

---

## 2. Performance

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-P01 | Dashboard initial load (p95) | <2 seconds | P0 | 2 | Load test |
| NFR-P02 | ERP list page load (p95) | <1.5 seconds (50 rows) | P0 | 2 | Load test |
| NFR-P03 | Guest order page load (p95) | <1 second | P1 | 2 | Lighthouse |
| NFR-P04 | Public catalog TTFB (cached) | <200ms | P1 | 2 | CDN metrics |
| NFR-P05 | RPC response time (p95) | <500ms | P0 | 2 | Supabase logs |
| NFR-P06 | Report export (1000 rows) | <10 seconds | P1 | 2 | Manual test |
| NFR-P07 | AI forecast generation | <5 seconds | P1 | 4 | AI service metrics |
| NFR-P08 | Tenant provisioning | <60 seconds | P0 | 3 | E2E test |
| NFR-P09 | Concurrent ERP users | 100 without degradation | P0 | 2 | k6 load test |
| NFR-P10 | Concurrent guest orders | 50/min per tenant | P1 | 2 | Load test |

---

## 3. Scalability

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-S01 | Sales records per tenant | 500,000+ | P0 | 2 | Load test |
| NFR-S02 | Orders per day per tenant | 1,000+ | P0 | 2 | Load test |
| NFR-S03 | Concurrent tenants on shared DB | 100+ | P0 | 3 | Load test |
| NFR-S04 | Users per tenant | 200+ | P1 | 3 | Config test |
| NFR-S05 | Products per tenant | 10,000+ | P1 | 2 | Seed test |
| NFR-S06 | Database size per tenant | 10 GB | P1 | 3 | Monitoring |
| NFR-S07 | Horizontal scaling path | Cloudflare auto-scale | P1 | 2 | Architecture review |
| NFR-S08 | Read replica support | Supabase read replicas | P2 | 2 | Config test |

---

## 4. Availability & Reliability

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-A01 | Platform uptime | 99.5% monthly | P0 | 5 | Status page |
| NFR-A02 | Planned maintenance window | <4 hours/month, off-peak | P1 | 5 | Ops runbook |
| NFR-A03 | RPO (Recovery Point Objective) | <1 hour | P0 | 1 | Supabase backups |
| NFR-A04 | RTO (Recovery Time Objective) | <4 hours | P0 | 1 | DR drill |
| NFR-A05 | Zero data loss on migration | 100% record integrity | P0 | 3 | Migration validation |
| NFR-A06 | Graceful degradation | Public catalog available if ERP down | P2 | 2 | Failover test |
| NFR-A07 | Error rate (5xx) | <0.1% of requests | P0 | 1 | Sentry metrics |

---

## 5. Security

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-SEC01 | Tenant data isolation | Zero cross-tenant access | P0 | 3 | RLS test suite + audit |
| NFR-SEC02 | Authentication | Supabase Auth JWT with refresh | P0 | 1 | Existing |
| NFR-SEC03 | Authorization | RLS + UI RBAC + server function auth | P0 | 1 | Pen test |
| NFR-SEC04 | Secrets management | No secrets in git; Cloudflare secrets | P0 | 1 | Git audit |
| NFR-SEC05 | HTTPS everywhere | TLS 1.2+ on all endpoints | P0 | 1 | SSL scan |
| NFR-SEC06 | Password policy | Min 8 chars (admin), min 6 (customer portal) | P1 | 1 | Auth test |
| NFR-SEC07 | Rate limiting (public) | Configurable per endpoint | P0 | 1 | WAF test |
| NFR-SEC08 | CAPTCHA (guest order) | Bot prevention on checkout | P1 | 1 | Manual test |
| NFR-SEC09 | SQL injection prevention | Parameterized queries + RLS | P0 | 1 | Pen test |
| NFR-SEC10 | XSS prevention | React auto-escaping + CSP headers | P0 | 1 | Security scan |
| NFR-SEC11 | CSRF protection | SameSite cookies + Bearer tokens | P0 | 1 | Security review |
| NFR-SEC12 | Audit logging | All admin actions logged | P1 | 1 | Existing |
| NFR-SEC13 | AI data isolation | No cross-tenant data in LLM prompts | P0 | 4 | AI pen test |
| NFR-SEC14 | Dependency scanning | Automated CVE checks in CI | P1 | 1 | CI pipeline |
| NFR-SEC15 | Session timeout | Configurable inactivity timeout | P2 | 3 | Auth test |
| NFR-SEC16 | SSO/SAML (Enterprise) | SAML 2.0 support | P2 | 5 | Integration test |

---

## 6. Data Privacy & Compliance

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-D01 | Data residency | Supabase region configurable | P1 | 3 | Config review |
| NFR-D02 | PII minimization | Collect only necessary customer data | P0 | 1 | Privacy review |
| NFR-D03 | Right to deletion | Customer data deletable on request | P1 | 3 | Manual test |
| NFR-D04 | Data export | Tenant can export all their data | P1 | 5 | Export test |
| NFR-D05 | Privacy Policy | Published and linked | P0 | 5 | Legal review |
| NFR-D06 | Terms of Service | Published and linked | P0 | 5 | Legal review |
| NFR-D07 | DPA (Data Processing Agreement) | Available for Enterprise | P2 | 5 | Legal review |
| NFR-D08 | Cookie consent | Banner for analytics cookies | P1 | 5 | UI test |
| NFR-D09 | Colombia Habeas Data | Compliance with Ley 1581 | P1 | 5 | Legal review |
| NFR-D10 | AI data retention | AI queries logged, deletable | P1 | 4 | Audit test |

---

## 7. Usability & Accessibility

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-U01 | Language | Spanish (es-CO) primary | P0 | 1 | Existing |
| NFR-U02 | Currency display | COP with es-CO formatting | P0 | 1 | Existing |
| NFR-U03 | Responsive design | Functional on tablet (768px+) | P1 | 1 | Manual test |
| NFR-U04 | Mobile guest order | Fully functional on mobile | P0 | 1 | Manual test |
| NFR-U05 | Onboarding time | New tenant operational in <1 hour | P0 | 3 | User test |
| NFR-U06 | Error messages | User-friendly Spanish messages | P1 | 1 | UX review |
| NFR-U07 | WCAG 2.1 Level A | Basic accessibility | P2 | 5 | Accessibility audit |
| NFR-U08 | Keyboard navigation | Core flows navigable by keyboard | P2 | 5 | Manual test |
| NFR-U09 | LATAM i18n readiness | Locale hooks for future PT/EN | P2 | 3 | Code review |

---

## 8. Maintainability & Operability

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-M01 | Test coverage (lib) | ≥60% | P0 | 1 | CI coverage report |
| NFR-M02 | E2E smoke tests | ≥8 critical path tests | P0 | 1 | CI pipeline |
| NFR-M03 | CI pipeline duration | <10 minutes | P1 | 1 | CI metrics |
| NFR-M04 | Route file max size | ≤300 LOC (refactored routes) | P1 | 1 | Lint rule |
| NFR-M05 | TypeScript strict mode | No `any` on RPC calls | P1 | 1 | TSC + lint |
| NFR-M06 | Migration versioning | All schema changes via migrations | P0 | 1 | Existing |
| NFR-M07 | Deployment frequency | Daily to staging, weekly to prod | P1 | 1 | CI/CD |
| NFR-M08 | Rollback capability | <15 minutes to previous version | P0 | 1 | DR drill |
| NFR-M09 | Documentation | README, RPC catalog, role matrix | P1 | 1 | Doc review |
| NFR-M10 | Monitoring dashboards | Error rate, latency, tenant count | P1 | 1 | Sentry + CF |

---

## 9. Compatibility & Interoperability

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-C01 | Browser support | Chrome, Firefox, Safari, Edge (last 2 versions) | P0 | 1 | Browser test |
| NFR-C02 | Export formats | PDF, Excel (xlsx) | P0 | 1 | Existing |
| NFR-C03 | Payment methods (Colombia) | Cash, transfer, Nequi, Daviplata, card | P0 | 1 | Existing |
| NFR-C04 | Stripe integration | Subscription billing webhooks | P0 | 5 | Integration test |
| NFR-C05 | API access (Scale tier) | REST/GraphQL read API | P2 | 5 | API test |
| NFR-C06 | Webhook outbound | Tenant-configurable event webhooks | P2 | 5 | Integration test |
| NFR-C07 | Data import | CSV import for customers, products | P1 | 3 | Import test |

---

## 10. Cost & Resource Efficiency

| ID | Requirement | Target | Priority | Phase | Verification |
|----|-------------|--------|----------|-------|--------------|
| NFR-CO01 | Cloudflare Workers cost | <$100/month at 50 tenants | P1 | 2 | Billing review |
| NFR-CO02 | Supabase cost | <$200/month at 50 tenants | P1 | 2 | Billing review |
| NFR-CO03 | AI cost per tenant | <15% of ARPU | P1 | 4 | Usage metering |
| NFR-CO04 | LLM token optimization | Cache forecasts daily | P1 | 4 | AI metrics |
| NFR-CO05 | Storage per tenant | <1 GB default | P1 | 3 | Storage monitoring |
| NFR-CO06 | Unit economics | LTV:CAC >3 at Growth tier | P0 | 5 | Financial model |

---

## 11. NFR Verification Matrix

| Phase | P0 NFRs | P1 NFRs | Verification Method |
|-------|---------|---------|---------------------|
| Phase 1 | 15 | 12 | CI, Sentry, git audit, pen test basics |
| Phase 2 | 6 | 10 | Load test, k6, CDN metrics |
| Phase 3 | 5 | 4 | RLS test suite, external security audit |
| Phase 4 | 1 | 4 | AI pen test, cost monitoring |
| Phase 5 | 4 | 8 | Legal review, beta feedback, financial model |

---

## 12. NFR Traceability

Each NFR maps to epics and user stories:

| NFR Category | Primary Epics | Key Stories |
|--------------|---------------|-------------|
| Performance | EPIC-004 | US-004-001 through US-004-005 |
| Security | EPIC-001, EPIC-006 | US-001-001 through US-001-005, US-006-003 |
| Scalability | EPIC-004, EPIC-006 | US-004-002, US-006-002 |
| Availability | EPIC-001 | US-001-003, US-001-006 |
| Data Privacy | EPIC-006, EPIC-011 | US-006-003, US-011-003 |
| Maintainability | EPIC-002, EPIC-003 | US-002-001 through US-002-006 |
| AI Security | EPIC-009 | US-009-003 |

---

## 13. Acceptance Gates

### Gate 1 — Phase 1 Exit (Stabilization)
- [ ] All P0 security NFRs met (SEC01–SEC05, SEC07, SEC09–SEC11)
- [ ] NFR-M01, M02, M06, M08 met
- [ ] NFR-A07 met (<0.1% error rate)

### Gate 2 — Phase 2 Exit (Scalability)
- [ ] NFR-P01 through P06, P09 met
- [ ] NFR-S01, S02 met
- [ ] Load test report published

### Gate 3 — Phase 3 Exit (Multi-Tenant)
- [ ] NFR-SEC01 met (zero cross-tenant access)
- [ ] NFR-S03 met (100 tenants)
- [ ] External security audit passed
- [ ] NFR-A05 met (migration integrity)

### Gate 4 — Phase 4 Exit (AI)
- [ ] NFR-SEC13 met
- [ ] NFR-CO03 met (<15% ARPU)
- [ ] NFR-P07 met

### Gate 5 — Launch (Commercial)
- [ ] NFR-A01 met (99.5% uptime over 30 days)
- [ ] NFR-D05, D06 met (legal docs published)
- [ ] NFR-CO06 met (unit economics validated)
- [ ] All P0 NFRs across all categories met
