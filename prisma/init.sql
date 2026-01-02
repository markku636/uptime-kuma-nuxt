-- Uptime Kuma Nuxt Database Initialization
-- Generated from Prisma schema

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "twofa_status" BOOLEAN NOT NULL DEFAULT false,
    "twofa_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "monitors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 60,
    "retry_interval" INTEGER NOT NULL DEFAULT 60,
    "maxretries" INTEGER NOT NULL DEFAULT 0,
    "timeout" INTEGER NOT NULL DEFAULT 48,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "hostname" TEXT,
    "port" INTEGER,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "body" TEXT,
    "headers" JSONB,
    "keyword" TEXT,
    "invert_keyword" BOOLEAN NOT NULL DEFAULT false,
    "ignore_tls" BOOLEAN NOT NULL DEFAULT false,
    "upside_down" BOOLEAN NOT NULL DEFAULT false,
    "auth_method" TEXT,
    "basic_auth_user" TEXT,
    "basic_auth_pass" TEXT,
    "push_token" TEXT,
    "proxy_id" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "max_redirects" INTEGER NOT NULL DEFAULT 10,
    "accepted_statuscodes" JSONB,
    "json_path" TEXT,
    "expected_value" TEXT,
    "grpc_url" TEXT,
    "grpc_proto_content" TEXT,
    "grpc_method" TEXT,
    "grpc_service_name" TEXT,
    "grpc_enable_tls" BOOLEAN NOT NULL DEFAULT false,
    "grpc_body" TEXT,
    "grpc_metadata" TEXT,
    "database_connection_string" TEXT,
    "database_query" TEXT,
    "docker_host" TEXT,
    "docker_daemon" TEXT,
    "docker_container" TEXT,
    "mqtt_topic" TEXT,
    "mqtt_username" TEXT,
    "mqtt_password" TEXT,
    "mqtt_success_message" TEXT,
    "kafka_brokers" JSONB,
    "kafka_topic" TEXT,
    "kafka_sasl_mechanism" TEXT,
    "kafka_username" TEXT,
    "kafka_password" TEXT,
    "rabbitmq_nodes" JSONB,
    "rabbitmq_username" TEXT,
    "rabbitmq_password" TEXT,
    "redis_connection_string" TEXT,
    "radius_secret" TEXT,
    "radius_called_station_id" TEXT,
    "radius_calling_station_id" TEXT,
    "game" TEXT,
    "parent" INTEGER,
    "children_ids" JSONB,
    "remote_browser_id" INTEGER,
    "dns_record_type" TEXT,
    "dns_resolver" TEXT,
    "expiry_notification" BOOLEAN NOT NULL DEFAULT false,
    "tls_expiry_days" JSONB,
    "tls_info" JSONB,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "heartbeats" (
    "id" BIGSERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "status" SMALLINT NOT NULL,
    "time" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "msg" TEXT,
    "ping" INTEGER,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "monitor_notifications" (
    "monitor_id" INTEGER NOT NULL,
    "notification_id" INTEGER NOT NULL,

    CONSTRAINT "monitor_notifications_pkey" PRIMARY KEY ("monitor_id","notification_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "status_pages" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'auto',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "show_tags" BOOLEAN NOT NULL DEFAULT false,
    "show_powered_by" BOOLEAN NOT NULL DEFAULT true,
    "custom_css" TEXT,
    "footer_text" TEXT,
    "google_analytics_id" TEXT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "status_page_groups" (
    "id" SERIAL NOT NULL,
    "status_page_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "status_page_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "status_page_monitors" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "send_url" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "status_page_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "incidents" (
    "id" SERIAL NOT NULL,
    "status_page_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'warning',
    "pin" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "monitor_tags" (
    "monitor_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "value" TEXT,

    CONSTRAINT "monitor_tags_pkey" PRIMARY KEY ("monitor_id","tag_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "proxies" (
    "id" SERIAL NOT NULL,
    "protocol" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "auth" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "password" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "docker_hosts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "docker_type" TEXT NOT NULL DEFAULT 'socket',
    "docker_daemon" TEXT,
    "connection_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docker_hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "maintenances" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "date_range" TEXT,
    "interval_day" INTEGER NOT NULL DEFAULT 1,
    "weekdays" TEXT,
    "days_of_month" TEXT,
    "time_range" TEXT,
    "cron" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "timezone_option" TEXT,
    "timezone_offset" TEXT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "maintenance_monitors" (
    "id" SERIAL NOT NULL,
    "maintenance_id" INTEGER NOT NULL,
    "monitor_id" INTEGER NOT NULL,

    CONSTRAINT "maintenance_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "maintenance_status_pages" (
    "id" SERIAL NOT NULL,
    "maintenance_id" INTEGER NOT NULL,
    "status_page_id" INTEGER NOT NULL,

    CONSTRAINT "maintenance_status_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "type" TEXT NOT NULL DEFAULT 'string',

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "remote_browsers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remote_browsers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_key') THEN
        CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'monitors_push_token_key') THEN
        CREATE UNIQUE INDEX "monitors_push_token_key" ON "monitors"("push_token");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'monitors_user_id_idx') THEN
        CREATE INDEX "monitors_user_id_idx" ON "monitors"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'monitors_active_idx') THEN
        CREATE INDEX "monitors_active_idx" ON "monitors"("active");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'heartbeats_monitor_id_time_idx') THEN
        CREATE INDEX "heartbeats_monitor_id_time_idx" ON "heartbeats"("monitor_id", "time" DESC);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'notifications_user_id_idx') THEN
        CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'status_pages_slug_key') THEN
        CREATE UNIQUE INDEX "status_pages_slug_key" ON "status_pages"("slug");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'status_pages_user_id_idx') THEN
        CREATE INDEX "status_pages_user_id_idx" ON "status_pages"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_user_id_idx') THEN
        CREATE INDEX "tags_user_id_idx" ON "tags"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'proxies_user_id_idx') THEN
        CREATE INDEX "proxies_user_id_idx" ON "proxies"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'docker_hosts_user_id_idx') THEN
        CREATE INDEX "docker_hosts_user_id_idx" ON "docker_hosts"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'maintenances_user_id_idx') THEN
        CREATE INDEX "maintenances_user_id_idx" ON "maintenances"("user_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'maintenance_monitors_maintenance_id_monitor_id_key') THEN
        CREATE UNIQUE INDEX "maintenance_monitors_maintenance_id_monitor_id_key" ON "maintenance_monitors"("maintenance_id", "monitor_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'maintenance_status_pages_maintenance_id_status_page_id_key') THEN
        CREATE UNIQUE INDEX "maintenance_status_pages_maintenance_id_status_page_id_key" ON "maintenance_status_pages"("maintenance_id", "status_page_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'api_keys_key_key') THEN
        CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'settings_key_key') THEN
        CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'remote_browsers_user_id_idx') THEN
        CREATE INDEX "remote_browsers_user_id_idx" ON "remote_browsers"("user_id");
    END IF;
END $$;

-- Add TLS certificate columns if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'expiry_notification') THEN
        ALTER TABLE "monitors" ADD COLUMN "expiry_notification" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'tls_expiry_days') THEN
        ALTER TABLE "monitors" ADD COLUMN "tls_expiry_days" JSONB;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'tls_info') THEN
        ALTER TABLE "monitors" ADD COLUMN "tls_info" JSONB;
    END IF;
END $$;

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'monitors_user_id_fkey') THEN
        ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'monitors_proxy_id_fkey') THEN
        ALTER TABLE "monitors" ADD CONSTRAINT "monitors_proxy_id_fkey" FOREIGN KEY ("proxy_id") REFERENCES "proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'heartbeats_monitor_id_fkey') THEN
        ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notifications_user_id_fkey') THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'monitor_notifications_monitor_id_fkey') THEN
        ALTER TABLE "monitor_notifications" ADD CONSTRAINT "monitor_notifications_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'monitor_notifications_notification_id_fkey') THEN
        ALTER TABLE "monitor_notifications" ADD CONSTRAINT "monitor_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'status_page_groups_status_page_id_fkey') THEN
        ALTER TABLE "status_page_groups" ADD CONSTRAINT "status_page_groups_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'status_page_monitors_group_id_fkey') THEN
        ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "status_page_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'status_page_monitors_monitor_id_fkey') THEN
        ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'incidents_status_page_id_fkey') THEN
        ALTER TABLE "incidents" ADD CONSTRAINT "incidents_status_page_id_fkey" FOREIGN KEY ("status_page_id") REFERENCES "status_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'monitor_tags_monitor_id_fkey') THEN
        ALTER TABLE "monitor_tags" ADD CONSTRAINT "monitor_tags_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'monitor_tags_tag_id_fkey') THEN
        ALTER TABLE "monitor_tags" ADD CONSTRAINT "monitor_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'maintenance_monitors_maintenance_id_fkey') THEN
        ALTER TABLE "maintenance_monitors" ADD CONSTRAINT "maintenance_monitors_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "maintenances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'maintenance_status_pages_maintenance_id_fkey') THEN
        ALTER TABLE "maintenance_status_pages" ADD CONSTRAINT "maintenance_status_pages_maintenance_id_fkey" FOREIGN KEY ("maintenance_id") REFERENCES "maintenances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'api_keys_user_id_fkey') THEN
        ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
