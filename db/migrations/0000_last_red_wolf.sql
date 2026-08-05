CREATE TYPE "public"."product_category" AS ENUM('fire_extinguisher', 'detection_alarm', 'suppression_system', 'accessory', 'service');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quotation_template" AS ENUM('supply', 'service_proposal');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('new', 'refill', 'maintenance');--> statement-breakpoint
CREATE SEQUENCE "public"."quotation_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "company_profile" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"tin" text,
	"vat_registered" boolean DEFAULT false NOT NULL,
	"main_address" text,
	"branch_address" text,
	"phones" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"email" text,
	"footer_line" text,
	"bank_account_name" text,
	"bank_account_no" text,
	"bank_branch" text,
	"signatory_name" text,
	"signatory_title" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address_line" text,
	"city_province" text,
	"contact_person" text,
	"contact_email" text,
	"contact_phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"service_kind" "service_kind" NOT NULL,
	"capacity_label" text DEFAULT '' NOT NULL,
	"capacity_lbs" numeric(8, 2),
	"unit_price" numeric(12, 2) NOT NULL,
	"effective_from" date DEFAULT CURRENT_DATE NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "product_specs_position_key" UNIQUE("product_id","position")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" "product_category" NOT NULL,
	"brand" text,
	"unit_label" text DEFAULT 'UNIT' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "quotation_exclusions_position_key" UNIQUE("quotation_id","position")
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"section_title" text,
	"product_id" uuid,
	"name" text NOT NULL,
	"service_kind" "service_kind" NOT NULL,
	"description" text,
	"specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity_label" text DEFAULT '' NOT NULL,
	"unit_label" text DEFAULT 'UNIT' NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(14, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED NOT NULL,
	CONSTRAINT "quotation_items_position_key" UNIQUE("quotation_id","position")
);
--> statement-breakpoint
CREATE TABLE "quotation_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"template" "quotation_template" NOT NULL,
	"subject_template" text,
	"salutation" text,
	"intro_paragraph" text,
	"closing_paragraph" text,
	"payment_terms" text,
	"delivery_terms" text,
	"warranty_terms" text,
	"mobilization" text,
	"validity_days" integer DEFAULT 30 NOT NULL,
	"show_bank_details" boolean DEFAULT false NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope_of_works" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_no" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"template" "quotation_template" DEFAULT 'supply' NOT NULL,
	"subject" text NOT NULL,
	"quote_date" date DEFAULT CURRENT_DATE NOT NULL,
	"validity_days" integer DEFAULT 30 NOT NULL,
	"currency" char(3) DEFAULT 'PHP' NOT NULL,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"attention_to" text,
	"salutation" text DEFAULT 'Dear Sir/Ma''am,' NOT NULL,
	"intro_paragraph" text,
	"closing_paragraph" text,
	"payment_terms" text,
	"delivery_terms" text,
	"warranty_terms" text,
	"mobilization" text,
	"show_bank_details" boolean DEFAULT false NOT NULL,
	"scope_of_works" jsonb,
	"notes" text,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"prepared_by_user_id" text,
	"signatory_name" text,
	"signatory_title" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_exclusions" ADD CONSTRAINT "quotation_exclusions_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "prices_current_variant_key" ON "prices" USING btree ("product_id","service_kind","capacity_label") WHERE "prices"."effective_to" IS NULL;--> statement-breakpoint
CREATE INDEX "prices_product_idx" ON "prices" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_idx" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_presets_slug_key" ON "quotation_presets" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_quote_no_key" ON "quotations" USING btree ("quote_no");--> statement-breakpoint
CREATE INDEX "quotations_customer_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_date_idx" ON "quotations" USING btree ("quote_date");