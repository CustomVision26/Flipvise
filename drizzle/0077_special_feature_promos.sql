CREATE TABLE IF NOT EXISTS "special_feature_promos" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "channel" varchar(40) NOT NULL,
  "code" varchar(64) NOT NULL,
  "label" varchar(120) NOT NULL,
  "percentOff" integer NOT NULL,
  "planIds" json NOT NULL,
  "stripeCouponId" varchar(80) NOT NULL,
  "stripePromotionCodeId" varchar(80),
  "active" boolean DEFAULT true NOT NULL,
  "startsAt" timestamp,
  "endsAt" timestamp,
  "createdByUserId" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "special_feature_promos_code_unique" UNIQUE("code")
);

ALTER TABLE "special_feature_promos" ALTER COLUMN "channel" TYPE varchar(40);

-- Earlier drafts of this table used snake_case. App queries expect camelCase.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'special_feature_promos'
      AND column_name = 'percent_off'
  ) THEN
    ALTER TABLE special_feature_promos RENAME COLUMN percent_off TO "percentOff";
    ALTER TABLE special_feature_promos RENAME COLUMN plan_ids TO "planIds";
    ALTER TABLE special_feature_promos RENAME COLUMN stripe_coupon_id TO "stripeCouponId";
    ALTER TABLE special_feature_promos RENAME COLUMN stripe_promotion_code_id TO "stripePromotionCodeId";
    ALTER TABLE special_feature_promos RENAME COLUMN starts_at TO "startsAt";
    ALTER TABLE special_feature_promos RENAME COLUMN ends_at TO "endsAt";
    ALTER TABLE special_feature_promos RENAME COLUMN created_by_user_id TO "createdByUserId";
    ALTER TABLE special_feature_promos RENAME COLUMN created_at TO "createdAt";
  END IF;
END $$;
