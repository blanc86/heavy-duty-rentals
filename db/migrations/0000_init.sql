CREATE TYPE "public"."actor_type" AS ENUM('customer', 'admin', 'system', 'webhook', 'anonymous');--> statement-breakpoint
CREATE TYPE "public"."addon_pricing_model" AS ENUM('per_day', 'flat', 'per_unit_per_day');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure', 'denied');--> statement-breakpoint
CREATE TYPE "public"."blackout_reason" AS ENUM('maintenance', 'inspection', 'transport', 'out_of_service', 'other');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('draft', 'pending_payment', 'confirmed', 'active', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."company_role" AS ENUM('owner', 'admin', 'procurement', 'finance', 'project_manager', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('active', 'suspended', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."delivery_direction" AS ENUM('outbound', 'return');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('scheduled', 'assigned', 'loading', 'in_transit', 'arrived', 'delivered', 'failed', 'returned');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('load_chart', 'manual', 'certificate', 'insurance', 'registration', 'inspection_report', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_visibility" AS ENUM('public', 'customer', 'internal');--> statement-breakpoint
CREATE TYPE "public"."fuel_policy" AS ENUM('wet', 'dry');--> statement-breakpoint
CREATE TYPE "public"."inspection_phase" AS ENUM('pre_hire', 'on_return');--> statement-breakpoint
CREATE TYPE "public"."inspection_result" AS ENUM('pass', 'pass_with_notes', 'fail');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('tax_invoice', 'simplified', 'credit_note');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'ar');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('invited', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('rental_charge', 'deposit_authorization', 'extension_charge', 'damage_charge');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mada', 'visa', 'mastercard', 'apple_pay', 'stc_pay', 'credit_terms', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'requires_action', 'authorized', 'captured', 'failed', 'voided', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('requested', 'in_review', 'priced', 'sent', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."rate_tier_name" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('held', 'confirmed', 'active', 'released', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('available', 'reserved', 'rented', 'in_transit', 'maintenance', 'inspection', 'out_of_service');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'pending_verification');--> statement-breakpoint
CREATE TABLE "auth_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_en" varchar(240) NOT NULL,
	"name_ar" varchar(240),
	"vat_number" varchar(20),
	"cr_number" varchar(20),
	"billing_address_en" text,
	"billing_address_ar" text,
	"billing_city" varchar(80),
	"contact_email" varchar(320),
	"contact_phone" varchar(32),
	"status" "company_status" DEFAULT 'pending_review' NOT NULL,
	"credit_limit_halalas" bigint DEFAULT 0 NOT NULL,
	"credit_terms_days" integer DEFAULT 0 NOT NULL,
	"approval_threshold_halalas" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "company_role" DEFAULT 'viewer' NOT NULL,
	"status" "member_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_credential" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(16) DEFAULT 'totp' NOT NULL,
	"secret_encrypted" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"last_used_counter" bigint,
	"recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_site" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid,
	"owner_user_id" uuid,
	"name" varchar(200) NOT NULL,
	"city" varchar(80) NOT NULL,
	"address_line" text NOT NULL,
	"latitude" varchar(32),
	"longitude" varchar(32),
	"contact_name" varchar(160),
	"contact_phone" varchar(32),
	"access_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(512),
	"mfa_satisfied_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone" varchar(32),
	"phone_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"preferred_locale" "locale" DEFAULT 'en' NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"status" "user_status" DEFAULT 'pending_verification' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"marketing_consent_at" timestamp with time zone,
	"marketing_consent_source" varchar(64),
	"marketing_consent_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"name_ar" varchar(160) NOT NULL,
	"city" varchar(80) NOT NULL,
	"city_ar" varchar(80) NOT NULL,
	"region" varchar(80) NOT NULL,
	"region_ar" varchar(80) NOT NULL,
	"address_en" text NOT NULL,
	"address_ar" text NOT NULL,
	"latitude" varchar(32),
	"longitude" varchar(32),
	"phone" varchar(32),
	"email" varchar(320),
	"working_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_service_area" boolean DEFAULT true NOT NULL,
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"visibility" "document_visibility" DEFAULT 'internal' NOT NULL,
	"title_en" varchar(200) NOT NULL,
	"title_ar" varchar(200) NOT NULL,
	"storage_key" varchar(200) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_image" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"storage_key" varchar(200) NOT NULL,
	"alt_en" varchar(240) NOT NULL,
	"alt_ar" varchar(240) NOT NULL,
	"width" integer,
	"height" integer,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_spec" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"group_en" varchar(80),
	"group_ar" varchar(80),
	"label_en" varchar(120) NOT NULL,
	"label_ar" varchar(120) NOT NULL,
	"value_en" varchar(200) NOT NULL,
	"value_ar" varchar(200) NOT NULL,
	"unit" varchar(24),
	"is_comparable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_category" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"name_ar" varchar(160) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"filter_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"icon_key" varchar(40),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"meta_title_en" varchar(200),
	"meta_title_ar" varchar(200),
	"meta_description_en" varchar(320),
	"meta_description_ar" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_class" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"manufacturer" varchar(120) NOT NULL,
	"model" varchar(120) NOT NULL,
	"description_en" text,
	"description_ar" text,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capacity_kg" bigint,
	"min_rental_days" integer DEFAULT 1 NOT NULL,
	"mobilisation_buffer_days" integer DEFAULT 0 NOT NULL,
	"demobilisation_buffer_days" integer DEFAULT 0 NOT NULL,
	"deposit_halalas" bigint DEFAULT 0 NOT NULL,
	"requires_operator" boolean DEFAULT false NOT NULL,
	"operator_included" boolean DEFAULT false NOT NULL,
	"fuel_policy" "fuel_policy" DEFAULT 'dry' NOT NULL,
	"transport_class" varchar(40) DEFAULT 'standard' NOT NULL,
	"requires_low_bed" boolean DEFAULT false NOT NULL,
	"requires_escort" boolean DEFAULT false NOT NULL,
	"instant_bookable" boolean DEFAULT true NOT NULL,
	"inclusions_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inclusions_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_notes_en" text,
	"safety_notes_ar" text,
	"meta_title_en" varchar(200),
	"meta_title_ar" varchar(200),
	"meta_description_en" varchar(320),
	"meta_description_ar" varchar(320),
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_unit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"supplier_id" uuid,
	"asset_code" varchar(40) NOT NULL,
	"serial_number" varchar(80),
	"year_of_manufacture" integer,
	"engine_hours" integer DEFAULT 0 NOT NULL,
	"status" "unit_status" DEFAULT 'available' NOT NULL,
	"last_inspection_at" timestamp with time zone,
	"next_inspection_due_at" timestamp with time zone,
	"acquisition_date" timestamp with time zone,
	"notes" text,
	"telematics_device_id" varchar(80),
	"is_demo_data" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_record" (
	"id" uuid PRIMARY KEY NOT NULL,
	"unit_id" uuid NOT NULL,
	"blackout_id" uuid,
	"type" varchar(60) NOT NULL,
	"description" text,
	"cost_halalas" bigint DEFAULT 0 NOT NULL,
	"performed_by" varchar(160),
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"hours_at_service" integer,
	"next_due_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_blackout" (
	"id" uuid PRIMARY KEY NOT NULL,
	"unit_id" uuid NOT NULL,
	"period" "tstzrange" NOT NULL,
	"reason" "blackout_reason" NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_option" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid,
	"code" varchar(40) NOT NULL,
	"name_en" varchar(160) NOT NULL,
	"name_ar" varchar(160) NOT NULL,
	"description_en" varchar(400),
	"description_ar" varchar(400),
	"pricing_model" "addon_pricing_model" NOT NULL,
	"rate_halalas" bigint NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"description_en" varchar(240),
	"description_ar" varchar(240),
	"discount_type" "discount_type" NOT NULL,
	"value" bigint NOT NULL,
	"min_subtotal_halalas" bigint DEFAULT 0 NOT NULL,
	"max_discount_halalas" bigint,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"per_customer_limit" integer DEFAULT 1 NOT NULL,
	"applies_to_category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_card" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_id" uuid NOT NULL,
	"branch_id" uuid,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_tier" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rate_card_id" uuid NOT NULL,
	"tier" "rate_tier_name" NOT NULL,
	"min_days" integer DEFAULT 1 NOT NULL,
	"rate_halalas" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(24) NOT NULL,
	"name_en" varchar(80) NOT NULL,
	"name_ar" varchar(80) NOT NULL,
	"rate_ppm" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transport_rate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"transport_class" varchar(40) NOT NULL,
	"distance_band_km_from" integer NOT NULL,
	"distance_band_km_to" integer,
	"mobilisation_halalas" bigint NOT NULL,
	"demobilisation_halalas" bigint NOT NULL,
	"low_bed_surcharge_halalas" bigint DEFAULT 0 NOT NULL,
	"escort_surcharge_halalas" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_addon" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"addon_option_id" uuid,
	"code" varchar(40) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"label_ar" varchar(160) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"pricing_model" "addon_pricing_model" NOT NULL,
	"unit_rate_halalas" bigint NOT NULL,
	"line_total_halalas" bigint NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"from_status" varchar(30),
	"to_status" varchar(30),
	"actor_user_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"tier" "rate_tier_name" NOT NULL,
	"unit_rate_halalas" bigint NOT NULL,
	"line_total_halalas" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(20) NOT NULL,
	"status" "booking_status" DEFAULT 'draft' NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"company_id" uuid,
	"project_site_id" uuid,
	"supplier_id" uuid,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"billable_days" integer NOT NULL,
	"delivery_required" boolean DEFAULT true NOT NULL,
	"delivery_distance_km" integer,
	"delivery_window_start" timestamp with time zone,
	"delivery_window_end" timestamp with time zone,
	"site_contact_name" varchar(160),
	"site_contact_phone" varchar(32),
	"site_address_line" text,
	"site_city" varchar(80),
	"site_access_notes" text,
	"po_number" varchar(80),
	"cost_centre" varchar(80),
	"project_code" varchar(80),
	"rental_subtotal_halalas" bigint DEFAULT 0 NOT NULL,
	"addons_subtotal_halalas" bigint DEFAULT 0 NOT NULL,
	"transport_subtotal_halalas" bigint DEFAULT 0 NOT NULL,
	"discount_halalas" bigint DEFAULT 0 NOT NULL,
	"taxable_subtotal_halalas" bigint DEFAULT 0 NOT NULL,
	"vat_rate_ppm" integer NOT NULL,
	"vat_halalas" bigint DEFAULT 0 NOT NULL,
	"deposit_halalas" bigint DEFAULT 0 NOT NULL,
	"total_halalas" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"pricing_snapshot" jsonb,
	"coupon_id" uuid,
	"terms_version" varchar(20),
	"terms_accepted_at" timestamp with time zone,
	"terms_accepted_ip" varchar(45),
	"idempotency_key" varchar(80),
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"refund_halalas" bigint DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkout_hold" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_token" varchar(64) NOT NULL,
	"class_id" uuid,
	"unit_id" uuid,
	"reservation_id" uuid,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(32),
	"consented_to_recovery" boolean DEFAULT false NOT NULL,
	"recovery_email_sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"converted_booking_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"unit_id" uuid NOT NULL,
	"booking_id" uuid,
	"status" "reservation_status" DEFAULT 'held' NOT NULL,
	"period" "tstzrange" NOT NULL,
	"billable_start" timestamp with time zone NOT NULL,
	"billable_end" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"held_by_token" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"booking_id" uuid,
	"amount_halalas" bigint NOT NULL,
	"balance_after_halalas" bigint NOT NULL,
	"reason" varchar(200) NOT NULL,
	"created_by_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description_en" varchar(400) NOT NULL,
	"description_ar" varchar(400) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_halalas" bigint NOT NULL,
	"line_subtotal_halalas" bigint NOT NULL,
	"vat_rate_ppm" integer NOT NULL,
	"vat_halalas" bigint NOT NULL,
	"line_total_halalas" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"invoice_number" varchar(40) NOT NULL,
	"type" "invoice_type" DEFAULT 'tax_invoice' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"seller_name" varchar(240) NOT NULL,
	"seller_vat_number" varchar(20),
	"seller_cr_number" varchar(20),
	"seller_address" text,
	"buyer_name" varchar(240) NOT NULL,
	"buyer_vat_number" varchar(20),
	"buyer_cr_number" varchar(20),
	"buyer_address" text,
	"subtotal_halalas" bigint NOT NULL,
	"vat_rate_ppm" integer NOT NULL,
	"vat_halalas" bigint NOT NULL,
	"total_halalas" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"previous_invoice_hash" varchar(128),
	"zatca_uuid" varchar(64),
	"zatca_clearance_status" varchar(40),
	"zatca_qr_payload" text,
	"pdf_storage_key" varchar(200),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_event_id" varchar(200) NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"signature_verified" boolean NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"related_payment_id" uuid,
	"processed_at" timestamp with time zone,
	"processing_result" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_intent_id" varchar(200),
	"provider_charge_id" varchar(200),
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"amount_halalas" bigint NOT NULL,
	"captured_halalas" bigint DEFAULT 0 NOT NULL,
	"refunded_halalas" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"method" "payment_method",
	"last4" varchar(4),
	"card_brand_label" varchar(40),
	"failure_code" varchar(80),
	"failure_message" varchar(400),
	"idempotency_key" varchar(80) NOT NULL,
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_halalas" bigint NOT NULL,
	"reason" varchar(240) NOT NULL,
	"provider_refund_id" varchar(200),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"idempotency_key" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_agreement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"terms_version" varchar(20) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"storage_key" varchar(200),
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"accepted_ip" varchar(45),
	"accepted_user_agent" varchar(512),
	"signature_provider" varchar(40),
	"signature_reference" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"direction" "delivery_direction" NOT NULL,
	"status" "delivery_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_window_start" timestamp with time zone,
	"scheduled_window_end" timestamp with time zone,
	"driver_user_id" uuid,
	"vehicle_reference" varchar(80),
	"requires_low_bed" boolean DEFAULT false NOT NULL,
	"requires_escort" boolean DEFAULT false NOT NULL,
	"permit_reference" varchar(120),
	"actual_departed_at" timestamp with time zone,
	"actual_arrived_at" timestamp with time zone,
	"failure_reason" text,
	"proof_storage_key" varchar(200),
	"gps_last_latitude" varchar(32),
	"gps_last_longitude" varchar(32),
	"gps_last_updated_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid,
	"unit_id" uuid NOT NULL,
	"phase" "inspection_phase" NOT NULL,
	"inspector_user_id" uuid,
	"engine_hours" integer,
	"fuel_level_percent" integer,
	"condition_rating" integer,
	"damage_found" boolean DEFAULT false NOT NULL,
	"damage_notes" text,
	"missing_accessories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" "inspection_result",
	"chargeable_damage_halalas" bigint DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"class_id" uuid,
	"description_raw" varchar(400),
	"quantity" integer DEFAULT 1 NOT NULL,
	"duration_days" integer,
	"priced_unit_rate_halalas" bigint,
	"priced_line_total_halalas" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(20) NOT NULL,
	"status" "quote_status" DEFAULT 'requested' NOT NULL,
	"requester_user_id" uuid,
	"company_id" uuid,
	"contact_name" varchar(160) NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"company_name_raw" varchar(240),
	"branch_id" uuid,
	"site_city" varchar(80),
	"site_address_line" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"requirements" text,
	"lift_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priced_subtotal_halalas" bigint,
	"priced_vat_halalas" bigint,
	"priced_total_halalas" bigint,
	"priced_notes" text,
	"valid_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"converted_booking_id" uuid,
	"assigned_to_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(160),
	"body" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"moderated_by_user_id" uuid,
	"moderation_note" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" varchar(20) NOT NULL,
	"booking_id" uuid,
	"user_id" uuid,
	"company_id" uuid,
	"subject" varchar(240) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(60) DEFAULT 'general' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"assigned_to_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" uuid,
	"type" varchar(60) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locale" "locale",
	"path" varchar(400),
	"referrer" varchar(400),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"locale" "locale" NOT NULL,
	"translation_group_id" uuid NOT NULL,
	"title" varchar(240) NOT NULL,
	"excerpt" varchar(500),
	"body_markdown" text NOT NULL,
	"hero_image_key" varchar(200),
	"meta_title" varchar(200),
	"meta_description" varchar(320),
	"og_image_key" varchar(200),
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"author_user_id" uuid,
	"related_class_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_branch_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor_ip" varchar(45),
	"actor_user_agent" varchar(512),
	"action" varchar(80) NOT NULL,
	"resource_type" varchar(60),
	"resource_id" varchar(64),
	"company_id" uuid,
	"outcome" "audit_outcome" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_hash" varchar(64),
	"entry_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" uuid PRIMARY KEY NOT NULL,
	"question_en" varchar(400) NOT NULL,
	"question_ar" varchar(400) NOT NULL,
	"answer_en" text NOT NULL,
	"answer_ar" text NOT NULL,
	"category_id" uuid,
	"class_id" uuid,
	"branch_id" uuid,
	"sort_order" varchar(8) DEFAULT '0' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"to_address" varchar(320),
	"channel" "notification_channel" NOT NULL,
	"template_key" varchar(80) NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_marketing" boolean DEFAULT false NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" varchar(200),
	"failure_reason" varchar(400),
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" varchar(12) DEFAULT '0' NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value_json" jsonb NOT NULL,
	"description_en" varchar(400),
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_member" ADD CONSTRAINT "company_member_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_member" ADD CONSTRAINT "company_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_member" ADD CONSTRAINT "company_member_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_credential" ADD CONSTRAINT "mfa_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_site" ADD CONSTRAINT "project_site_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_site" ADD CONSTRAINT "project_site_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_document" ADD CONSTRAINT "class_document_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_image" ADD CONSTRAINT "class_image_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_spec" ADD CONSTRAINT "class_spec_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_class" ADD CONSTRAINT "equipment_class_category_id_equipment_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_unit" ADD CONSTRAINT "equipment_unit_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_unit" ADD CONSTRAINT "equipment_unit_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_unit_id_equipment_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_blackout_id_unit_blackout_id_fk" FOREIGN KEY ("blackout_id") REFERENCES "public"."unit_blackout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_blackout" ADD CONSTRAINT "unit_blackout_unit_id_equipment_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_blackout" ADD CONSTRAINT "unit_blackout_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_option" ADD CONSTRAINT "addon_option_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_card" ADD CONSTRAINT "rate_card_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_card" ADD CONSTRAINT "rate_card_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_tier" ADD CONSTRAINT "rate_tier_rate_card_id_rate_card_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_rate" ADD CONSTRAINT "transport_rate_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon" ADD CONSTRAINT "booking_addon_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addon" ADD CONSTRAINT "booking_addon_addon_option_id_addon_option_id_fk" FOREIGN KEY ("addon_option_id") REFERENCES "public"."addon_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event" ADD CONSTRAINT "booking_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_item" ADD CONSTRAINT "booking_item_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_item" ADD CONSTRAINT "booking_item_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_item" ADD CONSTRAINT "booking_item_unit_id_equipment_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_user_id_user_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_project_site_id_project_site_id_fk" FOREIGN KEY ("project_site_id") REFERENCES "public"."project_site"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold" ADD CONSTRAINT "checkout_hold_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold" ADD CONSTRAINT "checkout_hold_unit_id_equipment_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold" ADD CONSTRAINT "checkout_hold_reservation_id_reservation_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold" ADD CONSTRAINT "checkout_hold_converted_booking_id_booking_id_fk" FOREIGN KEY ("converted_booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_unit_id_equipment_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation" ADD CONSTRAINT "reservation_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_event" ADD CONSTRAINT "payment_webhook_event_related_payment_id_payment_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement" ADD CONSTRAINT "rental_agreement_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_agreement" ADD CONSTRAINT "rental_agreement_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_driver_user_id_user_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_unit_id_equipment_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_inspector_user_id_user_id_fk" FOREIGN KEY ("inspector_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_converted_booking_id_booking_id_fk" FOREIGN KEY ("converted_booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_moderated_by_user_id_user_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_assigned_to_user_id_user_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_class_id_equipment_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."equipment_class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_token_hash_unique" ON "auth_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_token_user_purpose_idx" ON "auth_token" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "company_status_idx" ON "company" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "company_member_unique" ON "company_member" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "company_member_user_idx" ON "company_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_user_idx" ON "mfa_credential" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_site_company_idx" ON "project_site" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "project_site_owner_idx" ON "project_site" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_unique" ON "session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "user" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_slug_unique" ON "branch" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "branch_city_idx" ON "branch" USING btree ("city");--> statement-breakpoint
CREATE INDEX "branch_service_area_idx" ON "branch" USING btree ("is_service_area","is_active");--> statement-breakpoint
CREATE INDEX "class_document_class_idx" ON "class_document" USING btree ("class_id","visibility");--> statement-breakpoint
CREATE INDEX "class_image_class_idx" ON "class_image" USING btree ("class_id","sort_order");--> statement-breakpoint
CREATE INDEX "class_spec_class_idx" ON "class_spec" USING btree ("class_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_category_slug_unique" ON "equipment_category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "equipment_category_active_idx" ON "equipment_category" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_class_slug_unique" ON "equipment_class" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "equipment_class_category_idx" ON "equipment_class" USING btree ("category_id","is_active");--> statement-breakpoint
CREATE INDEX "equipment_class_capacity_idx" ON "equipment_class" USING btree ("capacity_kg");--> statement-breakpoint
CREATE INDEX "equipment_class_manufacturer_idx" ON "equipment_class" USING btree ("manufacturer");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_unit_asset_code_unique" ON "equipment_unit" USING btree ("asset_code");--> statement-breakpoint
CREATE INDEX "equipment_unit_class_branch_status_idx" ON "equipment_unit" USING btree ("class_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "equipment_unit_branch_idx" ON "equipment_unit" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "equipment_unit_inspection_due_idx" ON "equipment_unit" USING btree ("next_inspection_due_at");--> statement-breakpoint
CREATE INDEX "maintenance_unit_idx" ON "maintenance_record" USING btree ("unit_id","started_at");--> statement-breakpoint
CREATE INDEX "unit_blackout_unit_idx" ON "unit_blackout" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "addon_option_class_idx" ON "addon_option" USING btree ("class_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "addon_option_class_code_unique" ON "addon_option" USING btree ("class_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_code_unique" ON "coupon" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rate_card_class_idx" ON "rate_card" USING btree ("class_id","is_active");--> statement-breakpoint
CREATE INDEX "rate_card_branch_idx" ON "rate_card" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_tier_card_tier_unique" ON "rate_tier" USING btree ("rate_card_id","tier");--> statement-breakpoint
CREATE INDEX "tax_rate_code_idx" ON "tax_rate" USING btree ("code","valid_from");--> statement-breakpoint
CREATE INDEX "transport_rate_lookup_idx" ON "transport_rate" USING btree ("branch_id","transport_class","distance_band_km_from");--> statement-breakpoint
CREATE INDEX "booking_addon_booking_idx" ON "booking_addon" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_event_booking_idx" ON "booking_event" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_item_booking_idx" ON "booking_item" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_item_unit_idx" ON "booking_item" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_reference_unique" ON "booking" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_idempotency_key_unique" ON "booking" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "booking_customer_idx" ON "booking" USING btree ("customer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_company_idx" ON "booking" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_status_start_idx" ON "booking" USING btree ("status","start_date");--> statement-breakpoint
CREATE INDEX "booking_status_end_idx" ON "booking" USING btree ("status","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_hold_session_unique" ON "checkout_hold" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "checkout_hold_expires_idx" ON "checkout_hold" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reservation_unit_status_idx" ON "reservation" USING btree ("unit_id","status");--> statement-breakpoint
CREATE INDEX "reservation_booking_idx" ON "reservation" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reservation_expires_idx" ON "reservation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "credit_transaction_company_idx" ON "credit_transaction" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_line_invoice_idx" ON "invoice_line" USING btree ("invoice_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_number_unique" ON "invoice" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoice_booking_idx" ON "invoice" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoice" USING btree ("status","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_event_unique" ON "payment_webhook_event" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_received_idx" ON "payment_webhook_event" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_key_unique" ON "payment" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_booking_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_provider_intent_idx" ON "payment" USING btree ("provider_intent_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_idempotency_key_unique" ON "refund" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "refund_payment_idx" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "rental_agreement_booking_idx" ON "rental_agreement" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "delivery_booking_idx" ON "delivery" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "delivery_status_window_idx" ON "delivery" USING btree ("status","scheduled_window_start");--> statement-breakpoint
CREATE INDEX "delivery_driver_idx" ON "delivery" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "inspection_booking_idx" ON "inspection" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "inspection_unit_idx" ON "inspection" USING btree ("unit_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_item_quote_idx" ON "quote_item" USING btree ("quote_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_reference_unique" ON "quote" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "quote_status_idx" ON "quote" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quote_requester_idx" ON "quote" USING btree ("requester_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_booking_unique" ON "review" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "review_class_status_idx" ON "review" USING btree ("class_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "support_ticket_reference_unique" ON "support_ticket" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "support_ticket" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "support_ticket_user_idx" ON "support_ticket" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analytics_event_type_idx" ON "analytics_event" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_event_session_idx" ON "analytics_event" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "article_slug_locale_unique" ON "article" USING btree ("slug","locale");--> statement-breakpoint
CREATE INDEX "article_status_published_idx" ON "article" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "article_translation_group_idx" ON "article" USING btree ("translation_group_id");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_idx" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_company_idx" ON "audit_log" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "faq_scope_idx" ON "faq" USING btree ("class_id","branch_id","is_published");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_status_idx" ON "notification" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "rate_limit_expires_idx" ON "rate_limit_bucket" USING btree ("expires_at");