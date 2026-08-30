# FlowWatch — Data Schema

> Related docs: `ARCHITECTURE.md` (who talks to whom) · `RULES.md` (how constants are shared, not redefined)
> This file is the single source of truth for every payload shape and table column. If code and this file disagree, this file wins — fix the code.

## 1. MQTT topics

Prefix pattern: `flowwatch/{unit_id}/{category}/{name}` — `unit_id` is `unit1` or `unit2`.

| Topic | Direction | QoS | Retained | Payload |
|---|---|---|---|---|
| `flowwatch/{unit}/sensor/ultrasonic` | device → cloud | 0 | no | `{ "cm": float, "ts": iso8601 }` |
| `flowwatch/{unit}/sensor/waterlevel` | device → cloud | 0 | no | `{ "cm": float, "ts": iso8601 }` |
| `flowwatch/{unit}/status/actuator` | device → cloud | 1 | yes | `{ "state": "STANDBY"\|"LIFTING"\|"FLIPPING"\|"LOWERING"\|"ALERT_FLOOD"\|"FAULT", "ts": iso8601 }` |
| `flowwatch/{unit}/status/connectivity` | device → cloud | 1 | yes | `{ "wifi": bool, "ts": iso8601 }` |
| `flowwatch/{unit}/alert/blockage` | device → cloud | 1 | no | `{ "distance_cm": float, "ts": iso8601 }` |
| `flowwatch/{unit}/alert/flood` | device → cloud | 1 | no | `{ "level_cm": float, "ts": iso8601 }` |
| `flowwatch/{unit}/alert/fault` | device → cloud | 1 | no | `{ "code": string, "detail": string, "ts": iso8601 }` — see §4 for fault codes |
| `flowwatch/{unit}/control/override` | cloud → device | 1 | no | `{ "action": "trigger_cycle", "requested_by": string, "ts": iso8601 }` |

**Rule:** every payload carries its own `ts`. Don't rely on MQTT/broker receipt time — the device clock (NTP-synced on boot) is authoritative.

## 2. InfluxDB — time-series sensor data

**Bucket:** `flowwatch_{unit_id}` (one bucket per unit — keeps comparative queries in Sprint 6 trivial)

| Measurement | Tags | Fields |
|---|---|---|
| `ultrasonic` | `unit_id` | `distance_cm` (float) |
| `waterlevel` | `unit_id` | `level_cm` (float) |

## 3. MySQL — discrete events

```sql
CREATE TABLE events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  unit_id     VARCHAR(10)  NOT NULL,
  event_type  VARCHAR(50)  NOT NULL,  -- see §4 for allowed values
  detail      TEXT,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_unit_time (unit_id, created_at)
);
```

## 4. Controlled vocabularies

**`event_type` values** (MySQL `events.event_type` and used as prefixes in alert topics):
`blockage_detected`, `cycle_complete`, `flood_alert`, `sms_sent`, `fault`, `wifi_lost`, `wifi_restored`, `manual_override_triggered`

**Fault `code` values** (`flowwatch/{unit}/alert/fault` payload and `events.detail`):
`ACTUATOR_OVERCURRENT`, `LIMIT_SWITCH_TIMEOUT`, `CAMERA_UNAVAILABLE`, `SENSOR_OUT_OF_RANGE`

Add new values only in this file first — code references the constant, never a hardcoded string (see `RULES.md` §2, DRY).

## 5. Firmware config (single source, see RULES.md §2)

```cpp
// config.h — every threshold lives here ONCE, nowhere else
namespace Config {
  constexpr float BLOCKAGE_THRESHOLD_CM = 8.0;   // calibrate empirically, Sprint 3
  constexpr float FLOOD_THRESHOLD_CM    = 22.0;  // calibrate empirically, Sprint 3
  constexpr uint32_t LIMIT_SWITCH_TIMEOUT_MS = 5000;
  constexpr uint32_t ACTUATOR_OVERCURRENT_MA  = 2000;
  constexpr uint32_t SENSOR_PUBLISH_INTERVAL_MS = 2000;
}
```
