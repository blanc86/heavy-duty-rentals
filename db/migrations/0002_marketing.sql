CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"issuer_en" varchar(200),
	"issuer_ar" varchar(200),
	"reference_number" varchar(120),
	"valid_until" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"document_key" varchar(200),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_attribution" (
	"id" uuid PRIMARY KEY NOT NULL,
	"storage_key" varchar(200) NOT NULL,
	"author" varchar(240),
	"licence" varchar(80),
	"licence_url" varchar(500),
	"source_url" varchar(500),
	"title" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title_en" varchar(240) NOT NULL,
	"title_ar" varchar(240) NOT NULL,
	"summary_en" text,
	"summary_ar" text,
	"client_name" varchar(240),
	"sector_en" varchar(120),
	"sector_ar" varchar(120),
	"city" varchar(80),
	"city_ar" varchar(80),
	"year" integer,
	"duration_days" integer,
	"equipment_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_key" varchar(200),
	"consent_obtained" boolean DEFAULT false NOT NULL,
	"consent_note" varchar(400),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_en" text NOT NULL,
	"quote_ar" text NOT NULL,
	"author_name" varchar(160),
	"author_role_en" varchar(160),
	"author_role_ar" varchar(160),
	"company_name" varchar(240),
	"context_en" varchar(240),
	"context_ar" varchar(240),
	"consent_obtained" boolean DEFAULT false NOT NULL,
	"consent_note" varchar(400),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credential_published_idx" ON "credential" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "image_attribution_key_unique" ON "image_attribution" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_slug_unique" ON "project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "project_published_idx" ON "project" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE INDEX "testimonial_published_idx" ON "testimonial" USING btree ("is_published","sort_order");--> statement-breakpoint

-- =============================================================================
-- CONSENT IS A CONSTRAINT, NOT A CONVENTION
--
-- Publishing a named client's endorsement or a named reference project without
-- their permission is a commercial problem and, where the name identifies an
-- individual, a PDPL problem.
--
-- Enforcing it in the database means it survives a new query, a new admin
-- screen, or a bulk import written in a hurry. A checkbox in an admin form
-- does not.
-- =============================================================================
ALTER TABLE "testimonial"
  ADD CONSTRAINT "testimonial_published_requires_consent"
  CHECK ("is_published" = FALSE OR "consent_obtained" = TRUE);--> statement-breakpoint

ALTER TABLE "project"
  ADD CONSTRAINT "project_published_requires_consent"
  CHECK ("is_published" = FALSE OR "consent_obtained" = TRUE);--> statement-breakpoint

-- A named client on a published project needs consent for THAT name
-- specifically; a project described only by sector does not identify anyone.
ALTER TABLE "project"
  ADD CONSTRAINT "project_named_client_requires_consent"
  CHECK ("client_name" IS NULL OR "consent_obtained" = TRUE);--> statement-breakpoint

ALTER TABLE "testimonial"
  ADD CONSTRAINT "testimonial_named_company_requires_consent"
  CHECK ("company_name" IS NULL OR "consent_obtained" = TRUE);--> statement-breakpoint

-- =============================================================================
-- CREDENTIALS MUST BE VERIFIED BEFORE THEY ARE CLAIMED
--
-- This site is aimed at procurement teams who check. An unverifiable
-- certification badge is worse than none: it fails a vendor assessment AND
-- costs the relationship.
-- =============================================================================
ALTER TABLE "credential"
  ADD CONSTRAINT "credential_published_requires_verification"
  CHECK ("is_published" = FALSE OR "verified_at" IS NOT NULL);--> statement-breakpoint

-- Partial indexes: the public site only ever reads published rows.
CREATE INDEX "testimonial_live_idx" ON "testimonial" ("sort_order")
  WHERE is_published = TRUE;--> statement-breakpoint

CREATE INDEX "project_live_idx" ON "project" ("sort_order")
  WHERE is_published = TRUE;--> statement-breakpoint

CREATE INDEX "credential_live_idx" ON "credential" ("sort_order")
  WHERE is_published = TRUE;
