CREATE TYPE "public"."certificate_findings" AS ENUM('none', 'minor');--> statement-breakpoint
CREATE TYPE "public"."certificate_kind" AS ENUM('completion', 'safety_reliability');--> statement-breakpoint
CREATE SEQUENCE "public"."certificate_safety_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "kind" "certificate_kind" DEFAULT 'completion' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "findings" "certificate_findings" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "engineer_license_no" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "engineer_license_expiry" date;