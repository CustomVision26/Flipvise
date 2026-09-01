-- Company address on public Contact Us + Stripe invoice/receipt seller block

ALTER TABLE "platform_contact_settings"
  ADD COLUMN IF NOT EXISTS "companyAddress" json;

UPDATE "platform_contact_settings"
SET "companyAddress" = '{"name":"Flipvise Studio LLC","streetAddress":"6450 Aragon Way","line2":"apt 205","city":"Fort Myers","stateProvince":"Florida","postalCode":"33966","country":"United States"}'::json
WHERE "companyAddress" IS NULL;

ALTER TABLE "platform_contact_settings"
  ALTER COLUMN "companyAddress" SET NOT NULL;
