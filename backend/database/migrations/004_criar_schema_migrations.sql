CREATE TABLE schema_migrations (
  nome_arquivo VARCHAR(255) PRIMARY KEY,
  checksum_sha256 CHAR(64) NOT NULL,
  executada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  baseline BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT schema_migrations_checksum_formato CHECK (
    checksum_sha256 ~ '^[0-9a-f]{64}$'
  )
);
