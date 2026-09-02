-- Retire Focus Study Mode add-on from catalog and entitlements.

DELETE FROM "user_addon_entitlements"
WHERE "addonKey" = 'study_mode_focus';
--> statement-breakpoint

DELETE FROM "addon_catalog"
WHERE "key" = 'study_mode_focus';
