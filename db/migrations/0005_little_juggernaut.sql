CREATE TYPE "public"."panel_type" AS ENUM('conventional', 'addressable');--> statement-breakpoint
ALTER TYPE "public"."activity_entity" ADD VALUE 'service_report';--> statement-breakpoint
CREATE SEQUENCE "public"."service_report_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "service_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_no" text NOT NULL,
	"customer_name" text NOT NULL,
	"address" text NOT NULL,
	"project_title" text NOT NULL,
	"system_description" text NOT NULL,
	"service_date" date NOT NULL,
	"panel_type" "panel_type" DEFAULT 'conventional' NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"other_equipment" text,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"serviced_by_name" text,
	"serviced_by_title" text,
	"noted_by_name" text,
	"prepared_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_reports_report_no_key" ON "service_reports" USING btree ("report_no");--> statement-breakpoint
CREATE INDEX "service_reports_customer_idx" ON "service_reports" USING btree ("customer_name");--> statement-breakpoint
CREATE INDEX "service_reports_service_date_idx" ON "service_reports" USING btree ("service_date");