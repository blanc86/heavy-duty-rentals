# Deploying

Written against Vercel + Neon, which is what this is deployed on. Nothing here
is Vercel-specific except where it says so; the constraints are the app's.

---

## 1. What the platform has to provide

**Postgres with `btree_gist`.** Not optional and not a preference. The promise
that a machine cannot be double-booked is a GiST exclusion constraint over a
`tstzrange`, enforced by the database. Without the extension the migration fails
and the guarantee does not exist. Neon, Supabase and RDS all have it; several
"serverless Postgres" products do not.

**A connection pooler, if the app is serverless.** Each concurrent invocation is
its own process with its own pool, so a direct connection string exhausts
`max_connections` under very little load. Use the pooled endpoint, set
`DATABASE_POOL_MAX=1`, and set `DATABASE_TRANSACTION_POOLER=true` — PgBouncer in
transaction mode hands a different backend connection to each transaction, so
prepared statements are not there on the next one. That failure is intermittent
and concurrency-dependent, which is the worst way to discover it.

**More than one instance? Then a shared rate limiter.** See §3.

---

## 2. Environment

Every variable is documented in `.env.example`. The ones that are wrong by
default on a hosted deployment:

| Variable | Local | Hosted | Why |
|---|---|---|---|
| `DATABASE_POOL_MAX` | `10` | `1` on serverless | Each invocation holds its own pool |
| `DATABASE_TRANSACTION_POOLER` | `false` | `true` behind PgBouncer | Prepared statements break otherwise |
| `RATE_LIMIT_BACKEND` | `memory` | `postgres` | §3 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | unset | **must be set** | §4 |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | localhost | the real origin | CSRF origin check, payment return URLs, canonical tags |

`ENCRYPTION_KEY` and `APP_SECRET` are refused at boot if absent in production.
Generate each with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`DATABASE_URL` must contain `sslmode=require`. The boot check enforces the
string; customer PII must not cross a network in the clear.

---

## 3. Rate limiting will silently stop working if you skip this

`RATE_LIMIT_BACKEND=memory` keeps counters in a `Map` in one process. On
serverless, every cold start begins with an empty map and concurrent
invocations each keep their own — so login throttling and the booking-lookup
throttle stop existing under exactly the load they defend against. Nothing
errors. The control just is not there.

Set `RATE_LIMIT_BACKEND=postgres`. It uses the `rate_limit_bucket` table, which
already exists from the first migration.

---

## 4. Server Actions across instances

Next.js encrypts the values captured in a Server Action's closure. Unset,
each instance generates its own key, so a request served by a different instance
than the one that rendered the page cannot decrypt the action reference and the
form breaks — intermittently, in proportion to how many instances are running.

Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable base64 32-byte value, the
same across every instance, and keep it stable across deploys.

---

## 5. Deploying without a payment provider

`assertProductionReady` refuses to boot with `PAYMENT_PROVIDER=mock`, because a
deployment that takes bookings and settles nothing is worse than one that is
down.

The one escape is `DEMO_MODE=true`. It permits the mock provider **and** puts
"no real payments are processed" above the header on every page in both
languages. The label and the permission are the same switch on purpose: you
cannot have a payment-less deployment that does not say so. Startup logs it too,
so an operator who inherits the deployment learns it from the logs rather than
from a customer.

`DEMO_MODE=true` alongside a real provider is refused — the banner would be
lying while cards were genuinely charged.

To go live for real: get a SAMA-licensed PSP, set `PAYMENT_PROVIDER=moyasar`
with its three keys, set `DEMO_MODE=false`, and re-verify the webhook signature
path against the provider's sandbox first.

---

## 6. Order of operations

The order matters — the role grant covers `ALL TABLES IN SCHEMA public` as they
exist when it runs, so it must come after the migrations.

```bash
DATABASE_URL="<pooled url>" npm run db:migrate
DATABASE_URL="<pooled url>" npm run db:grant
DATABASE_URL="<pooled url>" npm run db:seed
```

`db:seed` refuses to run with the development bootstrap password when
`NODE_ENV=production`. Set `SEED_ADMIN_EMAIL` and a real `SEED_ADMIN_PASSWORD`.

Then deploy:

```bash
vercel --prod
```

---

## 7. Verifying a deployment, not just building it

A green build says the bundle compiled. These say the application works:

```bash
APP_URL="https://<host>" node scripts/verify-routes.mjs   # every page + link resolves
APP_URL="https://<host>" node scripts/verify-flow.mjs     # pricing, CSRF, webhook signatures
APP_URL="https://<host>" node scripts/pentest.mjs         # IDOR, escalation, headers, guest access
APP_URL="https://<host>" node scripts/verify-a11y.mjs     # WCAG 2.2 A/AA, both locales
```

The scripts that touch the database need `DATABASE_URL` pointed at the same one
the deployment uses — and they need OWNER rights to build their fixtures, which
is a different role from the one the app runs as (§8). Set `APP_DATABASE_ROLE`
so the pen test reports on the app's role rather than its own, and
`SEED_ADMIN_EMAIL` so it can find the admin fixture:

```bash
APP_URL="https://<host>" DATABASE_URL="<owner url>" APP_DATABASE_ROLE=hdr_app SEED_ADMIN_EMAIL="<your admin>" node scripts/pentest.mjs
```

**Things that only break on a real deployment.** `next dev` renders everything
dynamically and the scripts default to local conventions, so these three passed
every local check and still failed in production: a route declaring
`generateStaticParams` while the layout reads `cookies()` (500s on cold
requests, and the unhandled rejection exits the process); the mock checkout
refusing to serve under `NODE_ENV=production`; and the scripts using the
development session cookie name, which makes them authenticate as nobody and
report false breaches. Point the scripts at the deployment, not just at
localhost.

---

## 8. Which database role the app connects as

Provisioning `hdr_app` is not the same as using it. Migrations run as the owner;
the **application** should connect as `hdr_app`, which holds SELECT/INSERT on the
append-only tables and no UPDATE or DELETE. That is what makes "the audit log
cannot be rewritten" a control rather than a note — an UPDATE is refused with
`permission denied for table audit_log`.

`db:grant` creates the role NOLOGIN. To use it:

```sql
ALTER ROLE hdr_app WITH LOGIN PASSWORD '<generated>';
```

Then point `DATABASE_URL` at that role and keep the owner's URL for migrations.
Exercise it before switching — read the catalogue, write a booking, append an
audit row — because a role that cannot write audit entries fails every guarded
request.

On Vercel + Neon, note that the Neon integration owns `DATABASE_URL`. If it
re-syncs, it overwrites this with the owner's connection string and the app
silently returns to running as owner. Re-check §11 of the pen test after any
change to the integration.

---

## 9. Known operational gaps

These are honest gaps, not oversights, and each is named in
`docs/FINAL_REVIEW.md` with a next step:

- **No email or SMS.** Nothing is sent to customers. The booking reference shown
  on the confirmation page is the only way back into a booking, which is why
  that page tells the customer to save it.
- **No object storage driver.** `STORAGE_PROVIDER=s3` is refused at boot.
- **No ZATCA Phase 2 clearance.** Invoices are issued locally and labelled as
  not cleared. `TAX_INVOICE_PROVIDER=zatca` is refused at boot.
- **No account creation.** Customers do not have accounts by design; staff and
  business accounts are seeded, because onboarding one securely needs a
  set-your-password link delivered to a proven address, and there is no email
  transport to deliver it with.
