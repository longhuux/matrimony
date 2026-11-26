CREATE TYPE "public"."media_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "sku" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "status" "media_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_otp_email_created_idx" ON "auth_otp_tokens" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "auth_otp_expires_idx" ON "auth_otp_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_versions_inv_ver_uidx" ON "invitation_versions" USING btree ("invitation_id","version");--> statement-breakpoint
CREATE INDEX "invitations_user_status_idx" ON "invitations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "invitations_status_expires_idx" ON "invitations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "led_checkins_session_ticket_uidx" ON "led_checkins" USING btree ("led_session_id","ticket_number");--> statement-breakpoint
CREATE INDEX "led_checkins_session_status_created_idx" ON "led_checkins" USING btree ("led_session_id","status","created_at");--> statement-breakpoint
CREATE INDEX "media_assets_user_kind_status_idx" ON "media_assets" USING btree ("user_id","kind","status");--> statement-breakpoint
CREATE INDEX "media_assets_invitation_idx" ON "media_assets" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_expires_idx" ON "orders" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "wishes_inv_approved_created_idx" ON "wishes" USING btree ("invitation_id","is_approved","created_at");--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_balance_non_negative" CHECK ("ai_credit_ledger"."balance_after" >= 0);--> statement-breakpoint
ALTER TABLE "auth_otp_tokens" ADD CONSTRAINT "auth_otp_attempts_non_negative" CHECK ("auth_otp_tokens"."attempts" >= 0);--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_attendee_count_non_negative" CHECK ("guests"."attendee_count" >= 0);--> statement-breakpoint
ALTER TABLE "invitation_versions" ADD CONSTRAINT "invitation_versions_version_positive" CHECK ("invitation_versions"."version" >= 1);--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_version_positive" CHECK ("invitations"."version" >= 1);--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_view_count_non_negative" CHECK ("invitations"."view_count" >= 0);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_positive" CHECK ("media_assets"."size_bytes" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_amount_non_negative" CHECK ("orders"."amount_vnd" >= 0);--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_usage_count_non_negative" CHECK ("templates"."usage_count" >= 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_ai_credits_non_negative" CHECK ("users"."ai_credits" >= 0);