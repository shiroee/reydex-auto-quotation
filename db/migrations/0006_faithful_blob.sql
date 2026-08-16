CREATE TYPE "public"."service_report_kind" AS ENUM('checklist', 'photo_report');--> statement-breakpoint
CREATE TABLE "service_report_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plate_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_report_photos_position_key" UNIQUE("plate_id","position")
);
--> statement-breakpoint
CREATE TABLE "service_report_plates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"caption" text NOT NULL,
	CONSTRAINT "service_report_plates_position_key" UNIQUE("report_id","position")
);
--> statement-breakpoint
ALTER TABLE "service_reports" ALTER COLUMN "system_description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_reports" ADD COLUMN "kind" "service_report_kind" DEFAULT 'checklist' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_reports" ADD COLUMN "findings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "service_reports" ADD COLUMN "activities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "service_report_photos" ADD CONSTRAINT "service_report_photos_plate_id_service_report_plates_id_fk" FOREIGN KEY ("plate_id") REFERENCES "public"."service_report_plates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_report_plates" ADD CONSTRAINT "service_report_plates_report_id_service_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."service_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_report_photos_plate_idx" ON "service_report_photos" USING btree ("plate_id");--> statement-breakpoint
CREATE INDEX "service_report_plates_report_idx" ON "service_report_plates" USING btree ("report_id");