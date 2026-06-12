ALTER TABLE "campaign" ADD COLUMN "tier" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "stripe_session_id" text;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "contact_email" text;