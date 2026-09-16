CREATE TABLE "booking_shares" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	"revoked_at" timestamp,
	"issued_by" text,
	"issued_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "declarations" (
	"id" text PRIMARY KEY NOT NULL,
	"dish_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"allergens" jsonb NOT NULL,
	"suits" jsonb NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_actuals" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"food_spend" real,
	"staff_spend" real,
	"transport_spend" real,
	"other_spend" real,
	"guests_served" integer,
	"note" text,
	"recorded_by" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_shares" ADD CONSTRAINT "booking_shares_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_shares" ADD CONSTRAINT "booking_shares_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_actuals" ADD CONSTRAINT "event_actuals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_actuals" ADD CONSTRAINT "event_actuals_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_shares_booking_idx" ON "booking_shares" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "declarations_dish_idx" ON "declarations" USING btree ("dish_id","first_seen");--> statement-breakpoint
CREATE UNIQUE INDEX "declarations_fingerprint_idx" ON "declarations" USING btree ("dish_id","fingerprint");