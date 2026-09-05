-- =============================================================================
-- LEAST-PRIVILEGE APPLICATION ROLE  (hdr_app)
--
-- Run as the database OWNER, AFTER every migration:
--
--     npm run db:grant
--
-- Why this is a separate script and not a migration
-- -------------------------------------------------
-- Migrations run as the owner and must be able to create and drop objects.
-- The running application must not. Two different privilege sets means two
-- different roles, and the grants have to be re-applied after each migration
-- because a table created by a later migration is owned by the owner and is
-- invisible to `hdr_app` until granted. The script is idempotent, so running
-- it more often than necessary costs nothing.
--
-- What this buys
-- --------------
-- SQL injection, a leaked DATABASE_URL, or a compromised application process
-- gets DML on business tables only. It cannot DROP a table, cannot rewrite
-- history in the audit log, and cannot grant itself more.
--
-- The password is NOT set here. Set it out of band (secrets manager) with
--     ALTER ROLE hdr_app WITH PASSWORD '<from-secrets-manager>';
-- so it never enters a file that lives in git.
--
-- See docs/SECURITY.md §8.
-- =============================================================================

-- --- 1. The role ------------------------------------------------------------
-- NOLOGIN until a password is set out of band, so the role cannot be used
-- before it has been given a credential. LOGIN is granted by the ALTER ROLE
-- that sets the password.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hdr_app') THEN
    CREATE ROLE hdr_app NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    RAISE NOTICE 'Created role hdr_app (NOLOGIN). Set a password to enable login.';
  END IF;
END $$;

-- --- 2. Schema access -------------------------------------------------------
-- USAGE lets the role resolve names. CREATE is explicitly revoked: the
-- application has no business making tables at runtime.
GRANT USAGE ON SCHEMA public TO hdr_app;
REVOKE CREATE ON SCHEMA public FROM hdr_app;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- The database name is not a literal here, so this needs dynamic SQL.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO hdr_app', current_database());
END $$;

-- --- 3. Table privileges ----------------------------------------------------
-- This covers tables that exist RIGHT NOW. There is deliberately no
-- ALTER DEFAULT PRIVILEGES: a table created by a future migration should not
-- silently inherit full DML — most of all not a future append-only table,
-- which would arrive writable. The cost of that choice is that this script is
-- part of the deploy, run after `db:migrate`; the benefit is that adding a
-- table is a decision someone makes here rather than one that happens to them.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO hdr_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hdr_app;

-- Migration bookkeeping is the migrator's, not the application's.
REVOKE ALL ON TABLE "_migration" FROM hdr_app;
GRANT SELECT ON TABLE "_migration" TO hdr_app;

-- --- 4. APPEND-ONLY TABLES --------------------------------------------------
-- Applied LAST so a broad grant above can never re-open them.
--
-- The hash chain makes tampering detectable; removing the privilege makes it
-- impossible through the application at all. Detection alone is weaker than
-- prevention, and prevention alone leaves no evidence if it is bypassed — so
-- both, deliberately.
REVOKE UPDATE, DELETE ON TABLE "audit_log"             FROM hdr_app;
REVOKE UPDATE, DELETE ON TABLE "booking_event"         FROM hdr_app;
-- A processed webhook must never be edited or replayed away: the unique index
-- on (provider, provider_event_id) is what blocks replay, and an application
-- that could DELETE the row could replay the payment.
REVOKE UPDATE, DELETE ON TABLE "payment_webhook_event" FROM hdr_app;

-- --- 5. Report --------------------------------------------------------------
DO $$
DECLARE
  offenders text;
BEGIN
  SELECT string_agg(DISTINCT table_name, ', ')
    INTO offenders
    FROM information_schema.table_privileges
   WHERE grantee = 'hdr_app'
     AND privilege_type IN ('UPDATE', 'DELETE')
     AND table_name IN ('audit_log', 'booking_event', 'payment_webhook_event');

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Append-only tables still writable by hdr_app: %', offenders;
  END IF;

  RAISE NOTICE 'hdr_app privileges applied; append-only tables verified read/insert only.';
END $$;
