-- Add missing unique indexes for upsert onConflict in sap-sync
-- These tables were migrated without their unique constraints

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_canal_unique
  ON sap_cache_financeiro_canal (canal, mes);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_top_clientes_unique
  ON sap_cache_financeiro_top_clientes (card_code, mes);
