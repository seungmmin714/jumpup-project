-- 그로미 PostgreSQL 스키마 (§12)

CREATE TABLE IF NOT EXISTS pots (
  pot_id     TEXT PRIMARY KEY,
  plant_id   TEXT NOT NULL DEFAULT 'tomato-cherry',
  nickname   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry (
  id            BIGSERIAL PRIMARY KEY,
  pot_id        TEXT        NOT NULL,
  measured_at   TIMESTAMPTZ NOT NULL,
  soil_moisture SMALLINT,
  soil_raw      SMALLINT,
  temperature   REAL,
  humidity      SMALLINT,
  light_level   SMALLINT,
  light_raw     SMALLINT,
  mood          SMALLINT    NOT NULL,
  seq           SMALLINT    NOT NULL,
  proto_ver     SMALLINT    NOT NULL,
  fw_ver        TEXT        NOT NULL,
  source        TEXT        NOT NULL,
  -- §12.1 서버는 (potId, seq, measuredAt) 기준으로 중복을 무시한다
  CONSTRAINT telemetry_dedupe UNIQUE (pot_id, seq, measured_at)
);

CREATE INDEX IF NOT EXISTS telemetry_pot_time_idx ON telemetry (pot_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS care_logs (
  id          BIGSERIAL PRIMARY KEY,
  pot_id      TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  at          TIMESTAMPTZ NOT NULL,
  soil_before SMALLINT,
  soil_after  SMALLINT,
  amount_ml   SMALLINT,
  guided      BOOLEAN     NOT NULL DEFAULT false,
  note        TEXT
);

CREATE INDEX IF NOT EXISTS care_logs_pot_time_idx ON care_logs (pot_id, at DESC);
