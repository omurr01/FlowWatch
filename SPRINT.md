# FlowWatch — Sprint Plan

> Related docs: `PRD.md` (FR IDs referenced below) · `ARCHITECTURE.md` · `SCHEMA.md` · `RULES.md` · `DESIGN.md`
> Sequenced software-first: the full cloud pipeline and dashboard are built and validated against mock data before hardware bring-up, per your team's current approach.

## Sprint 0 — Contracts & Environment
**Goal:** freeze the data contracts and stand up infrastructure before writing feature code.
**Covers:** foundational, no FR directly (enables all)
**Tasks:**
- Provision VPS, deploy Mosquitto + Node-RED + InfluxDB + MySQL via one `docker-compose.yml`
- Finalize `SCHEMA.md` — topic names, payload shapes, table columns (treat as frozen after this sprint; changes require updating the doc first)
- Write the Python mock publisher (simulates ESP32 on the real topics)
- Set up broker ACLs per `ARCHITECTURE.md` §4
**Exit criteria:** `mosquitto_pub`/`sub` from a laptop confirms round-trip on every topic in `SCHEMA.md` §1, using scoped (non-admin) credentials.

## Sprint 1 — Data Pipeline
**Goal:** telemetry reaches storage correctly.
**Covers:** FR-5, FR-8
**Tasks:**
- Node-RED flow: MQTT → InfluxDB (sensor readings) and MQTT → MySQL (events), per `SCHEMA.md` §2/§3
- Node-RED HTTP endpoint for historical queries (`ARCHITECTURE.md` §1 — dashboard never queries DB directly)
**Exit criteria:** mock publisher's data is queryable in InfluxDB and visible via the HTTP endpoint.

## Sprint 2 — Dashboard Core
**Goal:** operator can see live state and send a command, against mock data.
**Covers:** FR-6, FR-7
**Tasks:**
- Build `useFlowWatchFeed` hook (real MQTT-over-WebSocket, per `ARCHITECTURE.md` §2)
- Build components per `DESIGN.md` §2, wired to real broker (mock publisher standing in for hardware)
- Wire `ControlButton` to publish `control/override`
**Exit criteria:** dashboard shows mock publisher's live values and a button click round-trips a message the mock subscriber can log.

## Sprint 3 — Firmware Core (bench only)
**Goal:** state machine and MQTT client run correctly on real ESP32, no actuators/hardware yet.
**Covers:** FR-1, FR-2, FR-5, FR-6
**Tasks:**
- Implement `sensors.cpp`, `mqtt_client.cpp`, `state_machine.cpp` per `RULES.md` §1/§4
- Calibrate `BLOCKAGE_THRESHOLD_CM` / `FLOOD_THRESHOLD_CM` against bench sensor readings, update `SCHEMA.md` §5
**Exit criteria:** ESP32 publishes real sensor data to the same dashboard built in Sprint 2, and responds to a remote override command by logging a state transition (actuators not yet attached).

## Sprint 4 — Hardware Integration
**Goal:** physical removal cycle works end-to-end on the bench.
**Covers:** FR-3, FR-10
**Tasks:**
- Wire actuators, servo, limit switches; implement `actuators.cpp`
- Implement safety interlocks: overcurrent halt, limit-switch timeout, per `ARCHITECTURE.md` §5
**Exit criteria:** full `STANDBY → LIFTING → FLIPPING → LOWERING → STANDBY` cycle runs autonomously on blockage detection and on remote command, 10/10 trials, no faults.

## Sprint 5 — Remote Path & Fallback
**Goal:** the complete system works with the operator physically remote from the prototype.
**Covers:** FR-4, FR-9
**Tasks:**
- Attach ESP32-CAM, wire visual confirmation into cycle-complete event
- Implement GSM/SIM800L fallback path, independent of MQTT (per `ARCHITECTURE.md` §5)
- Test from an actual remote network (not the same LAN as the VPS or device)
**Exit criteria:** trigger a cycle from a phone on a different network than the prototype; disconnect Wi-Fi at the device and confirm SMS alert fires.

## Sprint 6 — Reliability & Replication
**Goal:** second unit built, system proven stable, ready for formal evaluation.
**Covers:** all FRs — validation pass
**Tasks:**
- Replicate validated Sprint 0–5 build to Unit 2
- Run comparative + reliability trials (extended soak test, forced failure-mode trials per `ARCHITECTURE.md` §5)
- Freeze thresholds and firmware version for evaluation
**Exit criteria:** both units pass the same test battery; NFR targets in `PRD.md` §4 are met with logged evidence.

## Traceability check

Before closing any sprint, confirm every FR it claims to cover has a corresponding passing test or observed behavior — not just code that compiles. An FR with no verification is not done.
