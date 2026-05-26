CREATE TYPE "public"."device_status" AS ENUM('provisioning', 'online', 'offline', 'maintenance', 'decommissioned', 'error');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('RTU', 'PLC', 'SCADA_GATEWAY', 'FLOW_COMPUTER', 'SENSOR_HUB', 'ESP_CONTROLLER', 'WELLHEAD_CONTROLLER', 'EDGE_NODE');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."ota_device_status" AS ENUM('pending', 'downloading', 'installing', 'verifying', 'success', 'failed', 'skipped', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."ota_status" AS ENUM('draft', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'rolled_back');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"device_type" "device_type" NOT NULL,
	"manufacturer" varchar(128),
	"model" varchar(128),
	"serial_number" varchar(128),
	"firmware_version" varchar(64),
	"hardware_revision" varchar(32),
	"well_id" varchar(64),
	"field_location" varchar(128),
	"ip_address" varchar(45),
	"mac_address" varchar(17),
	"provisioning_token" varchar(128),
	"provisioning_token_expires_at" timestamp,
	"status" "device_status" DEFAULT 'provisioning' NOT NULL,
	"last_seen_at" timestamp,
	"last_heartbeat_at" timestamp,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"registered_by" integer,
	"notes" text,
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "firmware_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(64) NOT NULL,
	"device_type" "device_type" NOT NULL,
	"release_notes" text,
	"changelog_url" text,
	"firmware_url" text NOT NULL,
	"firmware_size" integer,
	"checksum" varchar(128),
	"is_stable" boolean DEFAULT false NOT NULL,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"min_hardware_revision" varchar(32),
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ota_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"firmware_version_id" integer NOT NULL,
	"target_device_type" "device_type" NOT NULL,
	"target_device_ids" text,
	"rollout_strategy" varchar(32) DEFAULT 'sequential' NOT NULL,
	"canary_percentage" integer DEFAULT 10,
	"status" "ota_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"total_devices" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ota_device_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"device_id" integer NOT NULL,
	"device_device_id" varchar(64),
	"from_version" varchar(64),
	"to_version" varchar(64) NOT NULL,
	"status" "ota_device_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"token" varchar(128) NOT NULL,
	"invited_by" integer,
	"inviter_name" varchar(128),
	"message" text,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
