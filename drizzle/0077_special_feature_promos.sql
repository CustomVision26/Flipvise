CREATE TABLE IF NOT EXISTS "special_feature_promos" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "channel" varchar(16) NOT NULL,
  "code" varchar(64) NOT NULL,
  "label" varchar(120) NOT NULL,
  "percent_off" integer NOT NULL,
  "plan_ids" json NOT NULL,
  "stripe_coupon_id" varchar(80) NOT NULL,
  "stripe_promotion_code_id" varchar(80),
  "active" boolean DEFAULT true NOT NULL,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "created_by_user_id" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "special_feature_promos_code_unique" UNIQUE("code")
);
