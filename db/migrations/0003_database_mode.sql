CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Every account created before this migration was made in practice (mock) mode, so a database that
-- already has users is a practice database. A fresh one stays unmarked until its first use claims it.
INSERT INTO "app_settings" ("key", "value") SELECT 'gateway_mode', 'mock' WHERE EXISTS (SELECT 1 FROM "users");
