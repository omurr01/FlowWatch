# FlowWatch — Sprint 1 Status (checked 2026-08-30)

> Status checkpoint captured on 2026-08-30 against the running local stack.
> Sprint 1 definition: `SPRINT.md` (covers FR-5, FR-8).

## Verdict: exit criteria met, sprint NOT closed

- ✅ Mock publisher's data is queryable in InfluxDB (bucket `flowwatch_unit1`).
- ✅ Events land in MySQL and are visible via the HTTP endpoint.
- 2 gaps remain (below) — close them before signing off Sprint 1.

## Evidence (live verification)

| Check | Result |
|---|---|
| MQTT → InfluxDB readings | `waterlevel` + `ultrasonic` queryable from `unit1` |
| MQTT → MySQL events | `blockage_detected`, `flood_alert`, `fault` logged with correct `unit_id`/`detail` |
| HTTP endpoints | `GET /api/readings?unit=unit1&measurement=...` and `GET /api/events` return data |
| Scoped device creds | Verified publishing as `device_unit1` through broker ACLs |
| Fault code mapping | `ACTUATOR_OVERCURRENT` → `events.detail` (SCHEMA §4) |

- Stack: all 4 containers healthy (`flowwatch-mosquitto`, `-nodered`, `-influxdb`, `-mysql`).
- Mock publisher run: `mock\.venv\Scripts\python.exe mock\mock_publisher.py --unit unit1 --username device_unit1 --password <from .env>`.

### Notes on stale live data
- InfluxDB row `unit_id=diagtest` (12:59:54) and MySQL event `distance_cm=undefined`
  (13:03:26) are leftover manual diagnostic artifacts — NOT bugs. Current flow
  produces correct payloads (`distance_cm=7.5`, `level_cm=23.07`, fault codes).
  Consider purging before sprint close.

## Open gaps

1. **FR-8 incomplete — status topics not routed to events.**
   `cycle_complete`, `wifi_lost`, `wifi_restored`, `sms_sent` exist in SCHEMA §4
   vocabulary, but no Node-RED node maps `flowwatch/{unit}/status/actuator` or
   `.../status/connectivity` into MySQL `events`. Only alerts + manual overrides
   are currently logged. Add status subscriptions + mapping (e.g. actuator state
   `STANDBY` after a cycle → `cycle_complete`).

2. **Hardcoded InfluxDB bucket `flowwatch_unit1`.**
   `nodered/data/flows.json` influx-write node writes to `flowwatch_unit1`
   unconditionally. SCHEMA §2 mandates one bucket per unit; unit2 reads would
   land in unit1's bucket. Needs a per-unit bucket strategy (dynamic bucket
   selection / function node resolving unit from topic).

## Repro / commands
- Node-RED HTTP: `http://localhost:1880/api/readings?unit=unit1&measurement=waterlevel&limit=5` and `http://localhost:1880/api/events?limit=5`
- Mock publisher venv lives under `mock\.venv\` (paho-mqtt installed, not committed).