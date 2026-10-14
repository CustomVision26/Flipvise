-- Public WhatsApp number on Contact Us and the page footer.

ALTER TABLE "platform_contact_settings"
  ADD COLUMN IF NOT EXISTS "whatsapp" varchar(64);
