-- =============================================================================
-- FlowWatch — MySQL Schema Init (Sprint 0)
-- SCHEMA.md §3: discrete event storage
-- Runs on first container start via docker-entrypoint-initdb.d
-- =============================================================================

USE flowwatch;

-- SCHEMA.md §3: discrete events table
CREATE TABLE IF NOT EXISTS events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  unit_id     VARCHAR(10)  NOT NULL,
  event_type  VARCHAR(50)  NOT NULL,  -- SCHEMA.md §4: controlled vocabulary
  detail      TEXT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_unit_time (unit_id, created_at)
);

-- =============================================================================
-- SCHEMA.md §4 — Controlled vocabulary reference (enforced in application layer)
--
-- event_type values:
--   blockage_detected, cycle_complete, flood_alert, sms_sent,
--   fault, wifi_lost, wifi_restored, manual_mode_activated, manual_mode_released
--
-- fault code values (stored in 'detail' column):
--   ACTUATOR_OVERCURRENT, LIMIT_SWITCH_TIMEOUT,
--   CAMERA_UNAVAILABLE, SENSOR_OUT_OF_RANGE
-- =============================================================================
