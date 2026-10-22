-- CreateTable
CREATE TABLE "shopgym"."rate_limits" (
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","bucket","window_start")
);

-- CreateIndex
CREATE INDEX "rate_limits_window_start_idx" ON "shopgym"."rate_limits"("window_start");
ALTER TABLE "shopgym"."rate_limits" ADD CONSTRAINT "rate_limits_count_check" CHECK (count > 0);
