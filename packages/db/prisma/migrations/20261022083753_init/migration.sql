-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "shopgym";

-- CreateTable
CREATE TABLE "shopgym"."episodes" (
    "id" UUID NOT NULL,
    "task_slug" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "env_version" INTEGER NOT NULL,
    "store_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "initial_state_hash" TEXT NOT NULL,
    "initial_state" JSONB NOT NULL,
    "expected" JSONB NOT NULL,
    "score" JSONB,
    "summary" TEXT,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopgym"."customers" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "created_on" DATE NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."products" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "reorder_threshold" INTEGER NOT NULL,
    "reorder_qty" INTEGER NOT NULL,
    "supplier" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."staff" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "on_duty" BOOLEAN NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."orders" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "placed_on" DATE NOT NULL,
    "shipped_on" DATE,
    "delivered_on" DATE,
    "shipping_address" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."order_items" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."payments" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "captured_on" DATE NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."refunds" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_step" INTEGER NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."replacements" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_step" INTEGER NOT NULL,

    CONSTRAINT "replacements_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."purchase_orders" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "created_step" INTEGER NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."approvals" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_step" INTEGER NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."threads" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."messages" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_step" INTEGER NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."calendar_events" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMP(0) NOT NULL,
    "ends_at" TIMESTAMP(0) NOT NULL,
    "customer_id" INTEGER,
    "created_step" INTEGER NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."budget" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "restock_budget_cents" INTEGER NOT NULL,
    "spent_cents" INTEGER NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."policy" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "rules" JSONB NOT NULL,

    CONSTRAINT "policy_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateTable
CREATE TABLE "shopgym"."action_log" (
    "episode_id" UUID NOT NULL,
    "id" INTEGER NOT NULL,
    "tool" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "result_digest" TEXT,

    CONSTRAINT "action_log_pkey" PRIMARY KEY ("episode_id","id")
);

-- CreateIndex
CREATE INDEX "episodes_expires_at_idx" ON "shopgym"."episodes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_episode_id_email_key" ON "shopgym"."customers"("episode_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "products_episode_id_sku_key" ON "shopgym"."products"("episode_id", "sku");

-- AddForeignKey
ALTER TABLE "shopgym"."customers" ADD CONSTRAINT "customers_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."products" ADD CONSTRAINT "products_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."staff" ADD CONSTRAINT "staff_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."orders" ADD CONSTRAINT "orders_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."orders" ADD CONSTRAINT "orders_episode_id_customer_id_fkey" FOREIGN KEY ("episode_id", "customer_id") REFERENCES "shopgym"."customers"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."order_items" ADD CONSTRAINT "order_items_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."order_items" ADD CONSTRAINT "order_items_episode_id_order_id_fkey" FOREIGN KEY ("episode_id", "order_id") REFERENCES "shopgym"."orders"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."order_items" ADD CONSTRAINT "order_items_episode_id_product_id_fkey" FOREIGN KEY ("episode_id", "product_id") REFERENCES "shopgym"."products"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."payments" ADD CONSTRAINT "payments_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."payments" ADD CONSTRAINT "payments_episode_id_order_id_fkey" FOREIGN KEY ("episode_id", "order_id") REFERENCES "shopgym"."orders"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."refunds" ADD CONSTRAINT "refunds_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."refunds" ADD CONSTRAINT "refunds_episode_id_order_id_fkey" FOREIGN KEY ("episode_id", "order_id") REFERENCES "shopgym"."orders"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."refunds" ADD CONSTRAINT "refunds_episode_id_payment_id_fkey" FOREIGN KEY ("episode_id", "payment_id") REFERENCES "shopgym"."payments"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."replacements" ADD CONSTRAINT "replacements_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."replacements" ADD CONSTRAINT "replacements_episode_id_order_id_fkey" FOREIGN KEY ("episode_id", "order_id") REFERENCES "shopgym"."orders"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."replacements" ADD CONSTRAINT "replacements_episode_id_product_id_fkey" FOREIGN KEY ("episode_id", "product_id") REFERENCES "shopgym"."products"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."purchase_orders" ADD CONSTRAINT "purchase_orders_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."purchase_orders" ADD CONSTRAINT "purchase_orders_episode_id_product_id_fkey" FOREIGN KEY ("episode_id", "product_id") REFERENCES "shopgym"."products"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."approvals" ADD CONSTRAINT "approvals_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."approvals" ADD CONSTRAINT "approvals_episode_id_order_id_fkey" FOREIGN KEY ("episode_id", "order_id") REFERENCES "shopgym"."orders"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."threads" ADD CONSTRAINT "threads_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."threads" ADD CONSTRAINT "threads_episode_id_customer_id_fkey" FOREIGN KEY ("episode_id", "customer_id") REFERENCES "shopgym"."customers"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."messages" ADD CONSTRAINT "messages_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."messages" ADD CONSTRAINT "messages_episode_id_thread_id_fkey" FOREIGN KEY ("episode_id", "thread_id") REFERENCES "shopgym"."threads"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."calendar_events" ADD CONSTRAINT "calendar_events_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."calendar_events" ADD CONSTRAINT "calendar_events_episode_id_staff_id_fkey" FOREIGN KEY ("episode_id", "staff_id") REFERENCES "shopgym"."staff"("episode_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."budget" ADD CONSTRAINT "budget_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."policy" ADD CONSTRAINT "policy_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopgym"."action_log" ADD CONSTRAINT "action_log_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "shopgym"."episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants Prisma cannot declare
ALTER TABLE "shopgym"."episodes" ADD CONSTRAINT "episodes_status_check" CHECK (status IN ('active','scored','expired'));
ALTER TABLE "shopgym"."customers" ADD CONSTRAINT "customers_tier_check" CHECK (tier IN ('standard','vip'));
ALTER TABLE "shopgym"."products" ADD CONSTRAINT "products_values_check" CHECK (stock >= 0 AND reorder_threshold >= 0 AND reorder_qty > 0 AND unit_price_cents > 0 AND unit_cost_cents > 0);
ALTER TABLE "shopgym"."staff" ADD CONSTRAINT "staff_role_check" CHECK (role IN ('support','manager','buyer'));
ALTER TABLE "shopgym"."orders" ADD CONSTRAINT "orders_status_check" CHECK (status IN ('pending','processing','shipped','delivered','refunded','partially_refunded','cancelled'));
ALTER TABLE "shopgym"."orders" ADD CONSTRAINT "orders_total_check" CHECK (total_cents >= 0);
ALTER TABLE "shopgym"."order_items" ADD CONSTRAINT "order_items_values_check" CHECK (qty > 0 AND unit_price_cents > 0);
ALTER TABLE "shopgym"."payments" ADD CONSTRAINT "payments_values_check" CHECK (amount_cents > 0 AND status IN ('captured','refunded'));
ALTER TABLE "shopgym"."refunds" ADD CONSTRAINT "refunds_amount_check" CHECK (amount_cents > 0);
ALTER TABLE "shopgym"."replacements" ADD CONSTRAINT "replacements_qty_check" CHECK (qty > 0);
ALTER TABLE "shopgym"."purchase_orders" ADD CONSTRAINT "purchase_orders_values_check" CHECK (qty > 0 AND total_cents = qty * unit_cost_cents);
ALTER TABLE "shopgym"."approvals" ADD CONSTRAINT "approvals_values_check" CHECK (amount_cents > 0 AND status IN ('pending'));
ALTER TABLE "shopgym"."threads" ADD CONSTRAINT "threads_status_check" CHECK (status IN ('open','replied'));
ALTER TABLE "shopgym"."messages" ADD CONSTRAINT "messages_author_check" CHECK (author IN ('customer','agent','staff'));
ALTER TABLE "shopgym"."calendar_events" ADD CONSTRAINT "calendar_events_time_check" CHECK (ends_at > starts_at);
ALTER TABLE "shopgym"."budget" ADD CONSTRAINT "budget_values_check" CHECK (restock_budget_cents >= 0 AND spent_cents >= 0);
