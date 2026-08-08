ALTER TYPE "public"."activity_entity" ADD VALUE 'certificate';--> statement-breakpoint
CREATE SEQUENCE "public"."certificate_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cert_no" text NOT NULL,
	"client_name" text NOT NULL,
	"project_title" text NOT NULL,
	"location" text NOT NULL,
	"completion_date" date NOT NULL,
	"issue_date" date DEFAULT CURRENT_DATE NOT NULL,
	"issue_place" text NOT NULL,
	"inspected_by" text,
	"accepted_by" text,
	"signatory_name" text,
	"signatory_title" text,
	"prepared_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_cert_no_key" ON "certificates" USING btree ("cert_no");--> statement-breakpoint
CREATE INDEX "certificates_client_idx" ON "certificates" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "certificates_issue_date_idx" ON "certificates" USING btree ("issue_date");