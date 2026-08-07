CREATE TYPE "public"."activity_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."activity_entity" AS ENUM('quotation', 'customer', 'item', 'quotation_type', 'user');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" "activity_action" NOT NULL,
	"entity" "activity_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"actor_user_id" text,
	"actor_name" text,
	"actor_email" text
);
--> statement-breakpoint
CREATE INDEX "activity_log_occurred_idx" ON "activity_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity","entity_id");