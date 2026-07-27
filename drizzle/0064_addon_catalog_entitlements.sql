CREATE TYPE "public"."addon_entitlement_source" AS ENUM('stripe', 'admin');--> statement-breakpoint
CREATE TYPE "public"."addon_entitlement_status" AS ENUM('active', 'canceled', 'revoked');--> statement-breakpoint
CREATE TABLE "addon_catalog" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "addon_catalog_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"marketingBlurb" text DEFAULT '' NOT NULL,
	"eligiblePlanIds" json DEFAULT '[]'::json NOT NULL,
	"stripePriceEnvKey" varchar(128) DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"publishedOnPricing" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_catalog_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pricingCatalogVisible" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedByUserId" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "user_addon_entitlements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_addon_entitlements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"addonKey" varchar(128) NOT NULL,
	"source" "addon_entitlement_source" NOT NULL,
	"status" "addon_entitlement_status" DEFAULT 'active' NOT NULL,
	"stripeSubscriptionId" varchar(255),
	"stripeSubscriptionItemId" varchar(255),
	"grantedByAdminUserId" varchar(255),
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"endsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "addon_catalog_key_uidx" ON "addon_catalog" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_addon_entitlements_user_addon_uidx" ON "user_addon_entitlements" USING btree ("userId","addonKey");--> statement-breakpoint
CREATE INDEX "user_addon_entitlements_user_id_idx" ON "user_addon_entitlements" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_addon_entitlements_addon_key_idx" ON "user_addon_entitlements" USING btree ("addonKey");--> statement-breakpoint
INSERT INTO "addon_catalog_settings" ("id", "pricingCatalogVisible") VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "addon_catalog" (
  "key",
  "name",
  "description",
  "marketingBlurb",
  "eligiblePlanIds",
  "stripePriceEnvKey",
  "active",
  "publishedOnPricing"
) VALUES (
  'study_mode_focus',
  'Focus Study Mode',
  'An optional study mode add-on for eligible paid plans.',
  'Unlock Focus Study Mode as a monthly add-on on top of your current plan.',
  '["pro","pro_plus","pro_plus_team_basic","pro_plus_team_gold","pro_plus_platinum_plan","pro_plus_enterprise","education_plus","education_gold","education_enterprise"]'::json,
  'STRIPE_ADDON_STUDY_MODE_FOCUS_PRICE_ID',
  true,
  false
)
ON CONFLICT ("key") DO NOTHING;
