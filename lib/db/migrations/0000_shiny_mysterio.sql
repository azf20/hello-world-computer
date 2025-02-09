CREATE TABLE IF NOT EXISTS "Charge" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" varchar(42) NOT NULL,
	"status" varchar DEFAULT 'NEW' NOT NULL,
	"product" varchar DEFAULT 'STARTERKIT' NOT NULL,
	"payerAddress" varchar(42),
	"amount" text NOT NULL,
	"currency" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"confirmedAt" timestamp,
	"expiresAt" timestamp,
	"transactionHash" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "StarterKit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creatorId" varchar(42),
	"claimerId" varchar(42),
	"chargeId" text,
	"createdAt" timestamp NOT NULL,
	"claimedAt" timestamp,
	"value" bigint NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserKnowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(42) NOT NULL,
	"type" varchar NOT NULL,
	"content" json NOT NULL,
	"createdAt" timestamp NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Charge" ADD CONSTRAINT "Charge_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StarterKit" ADD CONSTRAINT "StarterKit_creatorId_User_id_fk" FOREIGN KEY ("creatorId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StarterKit" ADD CONSTRAINT "StarterKit_claimerId_User_id_fk" FOREIGN KEY ("claimerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "StarterKit" ADD CONSTRAINT "StarterKit_chargeId_Charge_id_fk" FOREIGN KEY ("chargeId") REFERENCES "public"."Charge"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserKnowledge" ADD CONSTRAINT "UserKnowledge_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
