# FlowWatch — Sprint 1 Status (checked 2026-08-30, gaps fixed 2026-08-31)

> Status checkpoint captured on 2026-08-30 against the running local stack.
> Sprint 1 definition: `SPRINT.md` (covers FR-5, FR-8).

## Verdict: exit criteria met, sprint NOT closed — re-verify after fixes

- ✅ Mock publisher's data is queryable in InfluxDB (bucket `flowwatch_unit1`).
- ✅ Events land in MySQL and are visible via the HTTP endpoint.
- Both open gaps from the 2026-08-30 check are now addressed in the repo (see below).
  Re-run the live verification (sections below) before signing off Sprint 1.

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

## Gaps — closure status

1. ~~**FR-8 incomplete — status topics not routed to events.**~~ **FIXED (repo).**
   `nodered/data/flows.json` now subscribes `flowwatch/+/status/#` (`mqtt-status`) and maps
   it to MySQL `events` (`map-status-event`), logging only on state transitions:
   - `status/actuator` `STANDBY` after `LIFTING`/`FLIPPING`/`LOWERING` → `cycle_complete`
   - `status/connectivity` `wifi:true→false` → `wifi_lost`; `false→true` → `wifi_restored`
   - Same-state/retained messages are ignored (no event spam). Per-unit state held in
     node context.

2. ~~**Hardcoded InfluxDB bucket `flowwatch_unit1`.**~~ **FIXED (repo).**
   Write path now resolves the bucket from the topic: `split-sensor` sets
   `msg.bucket = flowwatch_{unit}`, then `route-sensor-bucket` (switch) selects
   `influx-write-unit1` / `influx-write-unit2` (SCHEMA §2 one bucket per unit).
   Unknown units hit a debug node instead of being mis-routed.
   `flowwatch_unit2` is provisioned by a one-shot `influxdb-init` compose service
   (idempotent, works on fresh and pre-existing volumes); Node-RED waits for it via
   `depends_on: service_completed_successfully`.

> These were changed in the repo and validated structurally (flows.json parses, all
> wires resolve; compose YAML loads). Re-run live verification below to close the sprint.

## Repro / commands
- Node-RED HTTP: `http://localhost:1880/api/readings?unit=unit1&measurement=waterlevel&limit=5` and `http://localhost:1880/api/events?limit=5`
- Mock publisher venv lives under `mock\.venv\` (paho-mqtt installed, not committed).

### Re-verify the gap fixes (requires Docker Desktop running)
1. `docker compose up -d` — `influxdb-init` provisions the per-unit bucket; confirm:
   `docker compose exec influxdb influx bucket list --org flowwatch --token <INFLUXDB_ADMIN_TOKEN from .env>`
   (expect both `flowwatch_unit1` and `flowwatch_unit2`.)
2. `mock\.venv\Scripts\python.exe mock\mock_publisher.py --unit unit2 --username device_unit2 --password <MQTT_DEVICE_UNIT2_PASSWORD from .env>`
   Wait for one cycle (blockage dip → cycle → STANDBY), then:
   - Readings land in unit2's bucket: `curl "http://localhost:1880/api/readings?unit=unit2&measurement=waterlevel&limit=5"` returns rows (not unit1's).
   - `curl "http://localhost:1880/api/events?unit=unit2"` shows `blockage_detected`, `cycle_complete`, and (on Ctrl+C on the mock) `wifi_lost`.