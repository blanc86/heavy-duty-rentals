# Security Documentation

**Version:** 1.0 · **Date:** 2026-09-02

> **Compliance disclaimer.** This document describes controls that are *implemented* or *designed*. It does **not** claim compliance with PDPL, NCA ECC, PCI-DSS, or any other framework. Compliance is an audited state established by qualified assessors, not a property of source code. Sections marked **[NOT IMPLEMENTED]** are honest gaps.

---

## 1. Threat model

### Assets, ranked by consequence of loss

| # | Asset | Loss scenario |
|---|---|---|
| 1 | Payment integrity | Rentals obtained without payment; forged refunds; fraudulent capture |
| 2 | Booking integrity | Double-booked crane → a machine fails to arrive at a live site → contractual damages and, in the worst case, a safety incident from improvised substitution |
| 3 | Customer & company PII | PDPL violation, SDAIA penalty, loss of enterprise contracts |
| 4 | Commercial data | Competitor learns rates, utilization and customer list |
| 5 | Admin control plane | Total compromise: rate manipulation, data exfiltration, fraudulent refunds |
| 6 | Documents | ID/CR/insurance documents leaked |
| 7 | Availability of service | Lost revenue; a stranded site |

### Adversaries

| Actor | Capability | Primary goal |
|---|---|---|
| Opportunistic scanner | Automated tooling, known CVEs | Any foothold |
| Fraudulent customer | Authenticated, patient, reads the client bundle | Rent below price; obtain equipment without paying; forge a refund |
| Competitor | Scraping, possibly an insider | Rates, fleet, customers |
| Malicious company member | Legitimate credentials in company A | Reach company B; escalate to admin |
| Credential-stuffing operator | Breach corpora, proxy pools | Account takeover |
| Targeted attacker | Skilled, motivated by a high-value target set | Enterprise client data, admin access |

### Trust boundaries
1. **Browser → server.** Nothing from the client is trusted. Prices, ids, quantities, totals and roles are all recomputed or re-resolved server-side.
2. **Payment provider → server.** Only cryptographically verified webhooks are trusted; client-reported payment status is discarded entirely.
3. **Uploaded file → storage.** Files are hostile until validated; never executed, never served from the app origin.
4. **App → database.** The app role holds the minimum privileges required.

---

## 2. Authentication

### Who authenticates

**Customers do not.** There is no registration endpoint and `/register` returns
404. A booking is made as a guest and reopened with its reference plus the email
it was booked with. The `user` row behind a guest booking carries
`is_guest = TRUE` and a `password_hash` that is not PHC format, so Argon2
verification cannot match it — the row exists for ownership scoping and cannot
sign in by construction. A database CHECK constraint forbids
`is_guest AND is_platform_admin`.

The password machinery below therefore protects **staff and business accounts**.

### Booking-scoped sessions

A reference + email match mints a session with `session.scoped_booking_id` set.
It is a deliberately weak credential and is confined accordingly:

- 4-hour TTL for both sliding and absolute expiry (not 30/90 days).
- `scopeFor` narrows every booking read to that one booking id — not to the
  other bookings the same address has made. Checked first and returned
  immediately, so no later branch can widen it.
- `guard()` refuses it unless the action sets `allowScopedSession`. Only
  cancellation does. The check runs after the other authorization checks, so it
  can only subtract from what they allowed.
- `getFullActor()` returns null for it, so account and admin pages reject it.
- A database CHECK forbids `scoped_booking_id` together with `mfa_satisfied_at`:
  a scoped session must never look like a second factor was cleared.
- Rate limited under the `login` bucket, because it is a guessing surface.

**Confused-deputy defence.** Anyone can type any email at checkout, so a booking
may attach to a `user` row that belongs to a real account holder.
`resolveGuestBooking` requires `is_guest = TRUE`, and checkout mints a scoped
session only when the resolved customer record is a guest. Without both, a
stranger could book with a staff address and receive a session carrying that
staff member's user id — narrow in what it reads, but wrong in whose name it
acts, and corrupting the audit trail.

### Passwords
- **argon2id** (`@node-rs/argon2`), memory-hard parameters (m=19456 KiB, t=2, p=1 — the OWASP baseline), unique per-user salt.
- Minimum 12 characters. **Length is the requirement; composition rules are not enforced** — they push users toward `Password1!` and measurably reduce entropy.
- Candidate passwords are checked against a breached-password list boundary; obvious application-specific terms are rejected.
- Hash verification is constant-time; a **dummy verify runs for unknown accounts** so response timing does not disclose whether an email is registered.

### Sessions
- Opaque 256-bit random tokens (`crypto.randomBytes(32)`), **stored only as SHA-256 hashes**. A database dump does not yield usable sessions.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, host-only, `__Host-` prefixed in production.
- Sliding expiry (30 days) **and** an absolute cap (90 days). Session id is **rotated on privilege change** (login, MFA completion, password change) — session fixation defence.
- Logout revokes server-side; clearing the cookie alone is not treated as logout.
- "Sign out everywhere" revokes all sessions for the user.

### MFA
- **TOTP** (RFC 6238), 30s window, ±1 step drift tolerance, secret encrypted at rest.
- **Replay-protected:** `lastUsedCounter` rejects reuse of a code inside its own window.
- Single-use recovery codes, stored hashed.
- **Mandatory for platform admins.** Available to business accounts; guests have no account to enrol.
- **[NOT IMPLEMENTED]** WebAuthn/passkeys — designed for, not built.

### Brute force and enumeration
| Endpoint | Limit |
|---|---|
| Login | 5 / 15 min per (IP + email), 20 / hour per IP |
| Booking lookup (reference + email) | shares the `login` bucket |
| Password reset request | 3 / hour per email, 10 / hour per IP |
| MFA verification | 5 / 10 min per user, then step-up lockout |
| Coupon validation | 10 / min per session |
| Booking creation | 10 / hour per user |

**Where the counters live matters as much as the numbers.** `RATE_LIMIT_BACKEND=memory`
is per-process: across N instances the effective limit is N x the configured one,
and on a serverless platform it is not a limit at all, because every cold start
begins with an empty map and concurrent invocations each keep their own. Any
deployment that is not a single long-lived process must set
`RATE_LIMIT_BACKEND=postgres`, which shares one counter in `rate_limit_bucket`.

That counter is incremented in a **single atomic upsert**. Read-then-write would
let two concurrent callers both read `count = limit - 1` and both be allowed —
and under an attack there is nothing but concurrent callers, so a limiter that
only holds when requests are serialised is decorative. An integration test fires
twenty simultaneous consumptions and asserts twenty distinct counts.

The window is fixed rather than sliding, so a caller who keeps hammering cannot
push their own reset further away.

- Progressive account lockout with a time decay (`failedLoginCount` + `lockedUntil`).
- **Uniform responses**: login and password reset return the same message and comparable timing regardless of whether the account exists. The booking lookup returns ONE message for a bad reference, a wrong email, and a booking owned by a real account — so it cannot be used as an oracle for which references exist.
- Verification and reset tokens: 256-bit random, stored hashed, single-use, 1-hour TTL, invalidated on password change.

---

## 3. Authorization

Two independent checks, both required, on every protected action:

```
canAct(actor, action, resource) =
      hasRolePermission(actor.role, action)      // RBAC
  AND ownsOrBelongsTo(actor, resource)           // resource-level
```

RBAC alone is insufficient — a `procurement` role legitimately holds `booking:read`, but only for *their own company's* bookings. Ownership alone is insufficient — a `viewer` owns their company's data but must not cancel rentals.

### Roles
| Role | Capabilities |
|---|---|
| `owner` | Everything within the company, incl. member and credit management |
| `admin` | Company settings, members, all bookings |
| `procurement` | Create bookings/quotes, manage sites; cannot approve above threshold |
| `finance` | Invoices, payments, credit; read-only on bookings |
| `project_manager` | Bookings for assigned sites; approve within threshold |
| `viewer` | Read-only |
| `platform_admin` | Internal operations — a **separate axis**; no company role can grant it |

### Tenant isolation
Company scoping is applied in the **repository layer**, not in route handlers or components. Repository functions take `companyId` resolved from the verified session and apply it as a mandatory predicate. There is no exported unscoped variant, so a developer cannot forget to scope a query — the unsafe call does not exist to be written.

Automated tests assert cross-tenant denial on every company-scoped route (see §11).

### IDOR defence
- All ids are UUIDs — non-sequential, non-enumerable.
- Every fetch-by-id is filtered by the actor's scope in the same query. Fetch-then-check is not used; a resource the actor cannot see simply does not exist for them (404, not 403, so existence is not disclosed).

---

## 4. The money-critical controls

### Price manipulation
The browser never supplies a price. It supplies *intent* — class, unit, dates, add-ons, coupon code. The server:
1. Loads rates from the database,
2. Recomputes the entire breakdown,
3. Compares to the client's claimed total,
4. On mismatch: **abort the booking** and write a `price_mismatch` audit event.

Rejecting alone would be enough to be safe; auditing is what makes a systematic attempt visible.

### Booking integrity
See `DATABASE.md` §5. Prevention is a PostgreSQL GiST exclusion constraint — a storage-engine guarantee, not application logic. Quantity and inventory are validated server-side against `equipment_unit` rows; a client cannot request a unit that is not bookable.

### Payment integrity
```
Client claims "paid"        → ignored, entirely
Provider webhook            → HMAC signature verified over the RAW body,
                              using a constant-time comparison,
                              BEFORE the body is parsed
                            → providerEventId unique-indexed  (replay defence)
                            → amount + currency compared to the booking
                            → only then does the booking transition
```
- Idempotency keys on payment and booking creation prevent duplicate charges.
- Refunds require an authorization check, are audited, and above a configurable threshold require a second admin approver. **[Approval workflow is T2 — the threshold check and audit exist; the second-approver UI does not.]**
- **No card data is stored or logged.** The schema cannot hold a PAN or CVV. Card entry happens in the provider's hosted/tokenised context.

### Coupons
Validated server-side only: validity window, minimum subtotal, per-customer limit, category eligibility, and a database `CHECK` on `redemptionCount <= maxRedemptions` so concurrent redemptions cannot exceed the cap.

---

## 5. Web application security

| Threat | Control |
|---|---|
| **SQL injection** | Drizzle parameterised queries throughout; no string-concatenated SQL. The single raw-SQL helper takes bound parameters only. |
| **XSS** | React escapes by default. `dangerouslySetInnerHTML` is used only for CMS content, which is sanitised through an allowlist. A strict CSP is the second layer. |
| **CSRF** | `SameSite=Lax` cookies + an Origin/Host check on every state-changing request + double-submit token on classic form posts. Server Actions carry Next.js's built-in action-id protection. |
| **SSRF** | No user-supplied URL is fetched server-side. Outbound calls go only to a hardcoded provider allowlist. |
| **Command injection** | No shell invocation from request paths. |
| **Path traversal** | Storage keys are server-generated UUIDs; no user input reaches a filesystem path. |
| **Open redirect** | Post-login redirects are validated against a same-origin relative-path allowlist. |
| **Clickjacking** | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| **Mass assignment** | Zod `.strict()` schemas — unknown keys are rejected, and only explicitly listed fields are ever written. |
| **Prototype pollution** | No recursive merge of user input; `Object.create(null)` for dynamic maps. |
| **Race conditions** | Database constraints and `SELECT … FOR UPDATE`, not application checks. |

### Security headers
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per-request>';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
  object-src 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(self)
Cross-Origin-Opener-Policy: same-origin
X-Frame-Options: DENY
```
CSP uses a **per-request nonce**, not `unsafe-inline` for scripts. `style-src 'unsafe-inline'` remains because of React's inline style attributes — a known, accepted, documented residual.

---

## 6. API security

Every endpoint enforces, in order: schema validation → authentication → authorization → rate limit → business logic → audit.

- **Explicit response schemas.** Database rows are mapped to DTOs; a column is never returned merely because it exists. `passwordHash`, `tokenHash`, `secretEncrypted` and internal flags have no path to a response body.
- Request body size cap (1 MB JSON; separate limits for uploads).
- Structured errors: a stable machine code plus a safe human message. **No stack traces, SQL, or internal identifiers reach a client.**
- All list endpoints are paginated with hard caps — no unbounded reads.

---

## 7. File upload security

| Control | Implementation |
|---|---|
| Type validation | Extension **and** MIME **and** magic-byte sniffing. The declared `Content-Type` is not trusted. |
| Size limits | Per-type caps (images 10 MB, documents 25 MB) |
| Storage | Private bucket, random UUID keys, no user-controlled path component |
| Serving | Short-lived (5 min) signed URLs, issued only after an authorization check |
| Execution | Never executed; served from a distinct origin with `Content-Disposition: attachment` for non-images |
| Image handling | Re-encoded server-side to strip EXIF (which carries GPS) and embedded payloads |
| **Malware scanning** | **[NOT IMPLEMENTED]** — the interface exists; wiring a scanning service is required before accepting customer document uploads in production |

---

## 8. Data protection

| Layer | Control |
|---|---|
| In transit | TLS 1.2+ everywhere, HSTS with preload, TLS-only database connections |
| At rest | Volume encryption on the managed database and object store |
| Application-level | MFA secrets encrypted with a dedicated key; password and session values one-way hashed |
| Key management | Cloud KMS / secrets manager; documented rotation procedure |
| Secrets | Never in git (`.gitignore` + `.env.example` only), never in the client bundle (only `NEXT_PUBLIC_*` is exposed, and nothing sensitive carries that prefix), never in logs |
| Environments | Separate credentials and separate databases per environment; **production data is never copied to development** |
| Backups | Automated, encrypted, PITR; restore tested on a schedule (**restore testing is a runbook item, not automated here**) |

### PDPL-driven data handling
- **Minimisation:** no national ID / Iqama is collected at booking. Identity verification is an operational step at machine handover.
- **Consent:** marketing consent is separate, unbundled, never pre-ticked, and stored with timestamp, source and IP. The send path *reads the consent column* — it is not a policy someone must remember.
- **Retention:** documented table in `DATABASE.md` §7 with a purge job boundary.
- **Residency:** in-Kingdom hosting is the default recommendation, avoiding the cross-border transfer regime.
- **Subject rights:** access and deletion request handling is a documented process. **[The self-service export/delete UI is NOT IMPLEMENTED.]**

---

## 9. Logging and audit

### Audit log
Append-only and **hash-chained**: each entry stores `previousHash` and `entryHash = SHA256(previousHash || canonicalJson(entry))`. Deleting or altering a historical row breaks the chain and is detectable by a verification job. The application role has no `UPDATE`/`DELETE` privilege on the table.

#### Least-privilege application role — `hdr_app`

Detection and prevention, deliberately both: the hash chain makes tampering *detectable*, and the privilege model makes it *impossible through the application*. Detection alone is weaker than prevention; prevention alone leaves no evidence if it is bypassed.

Migrations run as the database owner. The application connects as `hdr_app`, provisioned by `db/roles/grant-app-role.sql` (`npm run db:grant`, run after every migration):

| Capability | `hdr_app` |
|---|---|
| `SELECT`/`INSERT`/`UPDATE`/`DELETE` on business tables | Granted |
| `UPDATE`/`DELETE` on `audit_log`, `booking_event`, `payment_webhook_event` | **Revoked** |
| `INSERT` on those same tables (append) | Granted |
| `CREATE`/`DROP` of any object | Revoked (`CREATE` revoked on schema `public`; not the owner) |
| Granting itself more | Revoked (`NOSUPERUSER NOCREATEROLE NOINHERIT NOBYPASSRLS`) |

`payment_webhook_event` is on that list for a specific reason: the unique index on `(provider, provider_event_id)` is what blocks webhook replay, so an application able to `DELETE` a processed event could replay a payment.

**Verified by connecting as the role**, not by reading the grant table: `UPDATE`/`DELETE` on all three tables refused, `INSERT` into `audit_log` accepted, `DROP TABLE booking` refused ("must be owner"), `CREATE TABLE` refused ("permission denied for schema public"), ordinary business `UPDATE` accepted.

Until this was provisioned, migration 0001's `REVOKE` was a **no-op** — it is wrapped in `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hdr_app')`, and the role did not exist.

Audited: login success/failure, logout, password change, MFA enrolment/removal, role change, member add/remove, equipment change, **rate change**, booking create/cancel, payment, refund, invoice issue, document access, permission change, admin action, and every `denied` authorization outcome.

Each entry records actor, actor type, IP, user agent, action, resource, company, outcome, and redacted metadata.

### Never logged
Passwords, password hashes, session tokens, MFA secrets, TOTP codes, card data, reset tokens, full request bodies of authentication endpoints. A **redaction allowlist** in the audit writer enforces this rather than relying on call-site discipline.

### Application logs
Structured JSON, correlated by request id, PII-minimised (user ids, not names or emails).

---

## 10. Monitoring **[BOUNDARY ONLY]**

Interfaces are defined; no monitoring vendor is wired. Signals that must be connected before production:

- Authentication failure spikes (credential stuffing)
- Authorization denials by actor (privilege probing)
- `price_mismatch` events (manipulation attempts)
- Webhook signature failures (forgery attempts)
- Exclusion-constraint violations above baseline (contention, or scripted booking abuse)
- Payment failure rate, error rate, latency
- Rate-limit saturation by IP/ASN

---

## 11. Security testing

Automated tests that encode the invariants (in `tests/security/`):

| Test | Asserts |
|---|---|
| Tenant isolation | Company A member gets 404 on every company B resource across every scoped route |
| IDOR | Customer A cannot read/modify customer B's booking, invoice, document |
| Privilege escalation | `viewer` cannot mutate; no company role reaches admin routes; role cannot be self-elevated |
| Price manipulation | Tampered total is rejected; the booking is not created; an audit event is written |
| Coupon manipulation | Expired, over-redeemed, and ineligible coupons are rejected server-side |
| Double booking | N concurrent reservations on one unit for overlapping dates → exactly one succeeds |
| Webhook forgery | Unsigned and wrongly-signed webhooks change nothing |
| Webhook replay | The same `providerEventId` twice credits once |
| Session security | Cookie flags; revocation is effective; id rotates on privilege change |
| Rate limiting | Login and reset limits engage |
| Upload validation | Disallowed types, oversized files, and content-type spoofing are rejected |
| Error hygiene | No stack trace, SQL, or internal id appears in any error response |

**Also required, not automated here:** dependency vulnerability scanning (`npm audit` in CI), SAST, and — before production — an **independent penetration test**. Automated tests prove the invariants I thought of; they do not substitute for an adversary who thinks of others.

---

## 12. Incident response **[PROCESS — requires business ownership]**

1. **Detect** — alert, report, or anomaly review.
2. **Triage** — severity, scope, whether personal data is involved.
3. **Contain** — revoke sessions/credentials, disable affected paths, block sources.
4. **Eradicate & recover** — patch, rotate secrets, restore from clean backup.
5. **Notify** — **PDPL breach notification obligations and timelines must be confirmed with counsel and are business-owned.** Prepare regulator and data-subject templates in advance.
6. **Post-incident review** — root cause, control gaps, tracked remediation.

Requires named owners, an on-call rota, and a contact tree that this repository cannot supply.

---

## 13. Dependency and supply-chain management

- Lockfile committed; exact versions.
- `npm audit` in CI; the build fails on high/critical.
- Minimal dependency surface — every addition is a supply-chain decision. Current runtime dependencies: Next, React, Drizzle, `postgres`, Zod, `@node-rs/argon2`, `otpauth`. Nothing else.
- No `postinstall` scripts from untrusted packages.
- **[NOT IMPLEMENTED]** SBOM generation and signed builds.

---

## 14. NCA ECC mapping (indicative)

Provided to support a vendor security assessment. **This is a self-assessment of implemented technical controls, not an audit, and not a compliance claim.**

| ECC domain | Where addressed | Status |
|---|---|---|
| 1 — Cybersecurity Governance | Policies, roles, this document | Partial — organisational controls are business-owned |
| 2-1 Asset Management | Equipment/document/data inventory in schema | Partial |
| 2-2 Identity & Access Management | §2, §3 — argon2id, MFA, RBAC, least privilege | Implemented (technical) |
| 2-3 Information System Protection | §5 — hardening, headers, patching | Implemented |
| 2-4 Network Security | Private subnets, TLS-only | Deployment-dependent |
| 2-5 Mobile Security | Responsive web; no mobile app | N/A |
| 2-7 Cryptography | §8 — TLS, argon2id, KMS | Implemented |
| 2-8 Backup & Recovery | §8 — automated encrypted backups, PITR | Designed; restore testing is a runbook item |
| 2-10 Cybersecurity Event Logs | §9 — hash-chained audit log | Implemented |
| 2-11 Incident Management | §12 | Process defined; owners required |
| 2-13 Vulnerability Management | §13 + pen test requirement | Partial |
| 2-14 Penetration Testing | Required before production | **Not done** |
| 2-15 Application Security | §4, §5, §6, §7, §11 | Implemented |
| 4 — Third-Party & Cloud | Provider adapters, residency | Partial — vendor due diligence is business-owned |

---

## 15. Known gaps

Consolidated so nothing is buried:

1. No malware scanning on uploads
2. No independent penetration test
3. Monitoring/alerting is a boundary, not a wiring
4. No WebAuthn/passkeys
5. No self-service PDPL data export/delete UI
6. Refund second-approver UI is T2
7. No SBOM or signed builds
8. Backup restore testing is manual
9. ZATCA clearance is a stub — invoices are not tax-cleared
10. No live payment processing without merchant credentials

Each is tracked in `FINAL_REVIEW.md` with a recommended next step.
