CREATE TYPE "public"."file_kind" AS ENUM('pdf', 'geo_image');--> statement-breakpoint
CREATE TYPE "public"."status_field" AS ENUM('civil', 'layout', 'system_integrator', 'toll_notification', 'toll_operator');--> statement-breakpoint
CREATE TYPE "public"."status_tone" AS ENUM('done', 'progress', 'pending', 'cancelled', 'neutral');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plaza_id" integer,
	"field" text,
	"old_value" text,
	"new_value" text,
	"changed_by" integer,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "division_aliases" (
	"raw_name" text PRIMARY KEY NOT NULL,
	"division_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"zone_id" integer,
	CONSTRAINT "divisions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_row" integer,
	"field" text,
	"raw_value" text,
	"action" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plaza_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"plaza_id" integer NOT NULL,
	"kind" "file_kind" NOT NULL,
	"original_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"exif_lat" numeric(9, 6),
	"exif_long" numeric(9, 6),
	"uploaded_by" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"field" "status_field" NOT NULL,
	"label" text NOT NULL,
	"tone" "status_tone" NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "toll_plazas" (
	"id" serial PRIMARY KEY NOT NULL,
	"s_no" integer,
	"plaza_code" text,
	"plaza_name" text,
	"road_name" text NOT NULL,
	"sh_name" text,
	"entry_kind" text GENERATED ALWAYS AS (case when lower(trim("toll_plazas"."sh_name")) = 'bridge' then 'bridge' else 'road' end) STORED,
	"division_id" integer,
	"village_name" text,
	"chainage_raw" text,
	"chainage_m" integer,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"coords_need_review" boolean DEFAULT false NOT NULL,
	"road_len_2lane_km" numeric(9, 3),
	"road_len_4lane_plus_km" numeric(9, 3),
	"structure_len_2lane_km" numeric(9, 3),
	"structure_len_4lane_plus_km" numeric(9, 3),
	"road_len_total_km" numeric(9, 3) GENERATED ALWAYS AS (coalesce("toll_plazas"."road_len_2lane_km",0) + coalesce("toll_plazas"."road_len_4lane_plus_km",0)) STORED,
	"structure_len_total_km" numeric(9, 3) GENERATED ALWAYS AS (coalesce("toll_plazas"."structure_len_2lane_km",0) + coalesce("toll_plazas"."structure_len_4lane_plus_km",0)) STORED,
	"total_len_km" numeric(9, 3) GENERATED ALWAYS AS (coalesce("toll_plazas"."road_len_2lane_km",0) + coalesce("toll_plazas"."road_len_4lane_plus_km",0)
      + coalesce("toll_plazas"."structure_len_2lane_km",0) + coalesce("toll_plazas"."structure_len_4lane_plus_km",0)) STORED,
	"equivalent_len_km" numeric(9, 3) GENERATED ALWAYS AS (least(
      coalesce("toll_plazas"."road_len_2lane_km",0) + coalesce("toll_plazas"."road_len_4lane_plus_km",0)
        + 10 * (coalesce("toll_plazas"."structure_len_2lane_km",0) + coalesce("toll_plazas"."structure_len_4lane_plus_km",0)),
      5 * (coalesce("toll_plazas"."road_len_2lane_km",0) + coalesce("toll_plazas"."road_len_4lane_plus_km",0)
        + coalesce("toll_plazas"."structure_len_2lane_km",0) + coalesce("toll_plazas"."structure_len_4lane_plus_km",0)))) STORED,
	"apc" numeric(10, 2),
	"plaza_type_raw" text,
	"plaza_type" text,
	"civil_status_id" integer,
	"layout_status_id" integer,
	"si_status_id" integer,
	"notification_status_id" integer,
	"operator_status_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "zones_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "division_aliases" ADD CONSTRAINT "division_aliases_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "divisions" ADD CONSTRAINT "divisions_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plaza_files" ADD CONSTRAINT "plaza_files_plaza_id_toll_plazas_id_fk" FOREIGN KEY ("plaza_id") REFERENCES "public"."toll_plazas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "toll_plazas" ADD CONSTRAINT "toll_plazas_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "toll_plazas" ADD CONSTRAINT "toll_plazas_civil_status_id_status_options_id_fk" FOREIGN KEY ("civil_status_id") REFERENCES "public"."status_options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "toll_plazas" ADD CONSTRAINT "toll_plazas_layout_status_id_status_options_id_fk" FOREIGN KEY ("layout_status_id") REFERENCES "public"."status_options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "toll_plazas" ADD CONSTRAINT "toll_plazas_si_status_id_status_options_id_fk" FOREIGN KEY ("si_status_id") REFERENCES "public"."status_options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "toll_plazas" ADD CONSTRAINT "toll_plazas_notification_status_id_status_options_id_fk" FOREIGN KEY ("notification_status_id") REFERENCES "public"."status_options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "toll_plazas" ADD CONSTRAINT "toll_plazas_operator_status_id_status_options_id_fk" FOREIGN KEY ("operator_status_id") REFERENCES "public"."status_options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "status_options_field_label_uq" ON "status_options" USING btree ("field","label");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_division_idx" ON "toll_plazas" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_civil_idx" ON "toll_plazas" USING btree ("civil_status_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_layout_idx" ON "toll_plazas" USING btree ("layout_status_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_si_idx" ON "toll_plazas" USING btree ("si_status_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_notification_idx" ON "toll_plazas" USING btree ("notification_status_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_operator_idx" ON "toll_plazas" USING btree ("operator_status_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "toll_plazas_entry_kind_idx" ON "toll_plazas" USING btree ("entry_kind");