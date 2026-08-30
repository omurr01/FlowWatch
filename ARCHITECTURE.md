# FlowWatch — Architecture

> Related docs: `PRD.md` (requirements this satisfies) · `SCHEMA.md` (exact payloads/tables) · `RULES.md` (code-level constraints)
> This file is the source of truth for *component boundaries and data flow*. Don't restate topic names or table columns here — reference `SCHEMA.md`.

## 1. Component map

Each component has exactly one responsibility (SOLID: single-responsibility at the system level, not just class level).

| Component | Responsibility | Owns |
|---|---|---|
| **Firmware (ESP32)** | Read sensors, run the removal state machine, drive actuators, publish/subscribe MQTT | Physical control loop, safety interlocks |
| **ESP32-CAM** | Capture confirmation snapshot on cycle completion | Image capture only — no control logic |
| **MQTT Broker (Mosquitto)** | Transport sensor data and commands between device and cloud | Topic ACLs, TLS termination, WebSocket bridge for dashboard |
| **Node-RED** | Route MQTT messages into storage; expose read-only HTTP endpoints for history | All data-shape transformation between MQTT and databases |
| **InfluxDB** | Store time-series sensor readings | Sensor history only |
| **MySQL** | Store discrete events | Event/audit log only |
| **Dashboard (React)** | Render live state across the fleet, drill into a single unit, publish control commands | UI and user interaction only — no business logic, no direct DB access. Single shared credential for the whole fleet — no per-user scoping (see `PRD.md` §5) |
| **GSM module (SIM800L)** | Send SMS alerts when MQTT path is unavailable | Independent of Wi-Fi/cloud entirely |

No component reaches into another's storage directly. The dashboard never queries InfluxDB/MySQL itself — it goes through Node-RED's HTTP endpoint. This is the dependency-inversion boundary: swap Node-RED's internals freely without touching the dashboard, and vice versa.

**Fleet grouping** is a data-model concern, not a new component: sites contain units (see `SCHEMA.md` §2a), and Node-RED's history endpoint gains a fleet-summary variant that aggregates across units. No new service is introduced for this — same components, wider queries.

## 2. Data flow

**Telemetry (device → operator):**
```
ESP32 sensors → MQTT publish (TLS 8883) → Mosquitto → Node-RED
                                                          ├─→ InfluxDB (readings)
                                                          └─→ MySQL (events)
Mosquitto → WebSocket (9001) → Dashboard (live view)
Node-RED HTTP endpoint → Dashboard (historical charts, per-unit or fleet-wide)
```

**Control (operator → device):**
```
Dashboard button → MQTT publish (WebSocket, scoped creds) → Mosquitto → ESP32 subscribe → state machine
```

**Fallback (device → operator, no cloud):**
```
ESP32 detects Wi-Fi/MQTT failure → SIM800L → SMS direct to operator phone
```

See `SCHEMA.md` for exact topic names, payload shapes, and table columns.

## 3. Deployment topology

| Node | Runs | Reachability |
|---|---|---|
| Cloud VPS (public IP, static) | Mosquitto, Node-RED, InfluxDB, MySQL, dashboard static build | Always-on, internet-facing |
| ESP32 (site) | Firmware | Outbound-only connection to VPS — no inbound ports opened on-site |
| ESP32-CAM (site) | Camera firmware | Outbound-only, own Wi-Fi session |
| Operator device | Browser | Anywhere with internet — connects to VPS dashboard URL |

The device-initiates-outbound pattern is why remote control works without port forwarding or dynamic DNS: the VPS has the fixed address, not the site hardware.

## 4. Security model

- All MQTT traffic uses TLS (port 8883 for devices, WSS on 9001 for browser).
- Three credential scopes, least-privilege, enforced via broker ACL — never share one login across roles:
  | Client | Can publish to | Can subscribe to |
  |---|---|---|
  | ESP32 device | `flowwatch/{own_unit}/sensor/#`, `flowwatch/{own_unit}/status/#` | `flowwatch/{own_unit}/control/#` — each device is scoped to its own unit only, never another unit's topics |
  | Dashboard | `flowwatch/+/control/#` | `flowwatch/+/#` — single shared credential, fleet-wide, per `PRD.md` §5 (no per-user scoping) |
  | Node-RED (internal) | none (read-only bridge) | `flowwatch/+/#` |
- Dashboard never holds InfluxDB/MySQL credentials — only Node-RED does.
- GSM/SMS path has no network dependency, so it's unaffected by broker or VPS compromise.

## 5. Failure modes (must be handled, ties to PRD FR-10)

| Failure | Detection | Response |
|---|---|---|
| Wi-Fi/broker unreachable | Publish timeout | Switch to GSM SMS alert path |
| Actuator overcurrent | Current sensor threshold | Halt motion, publish fault event, hold state |
| Limit switch never reached | Timeout on expected transition | Halt motion, publish fault event |
| Camera unavailable | Capture call fails/times out | Continue cycle on sensor data alone, flag "visual confirmation unavailable" |
| Broker connection drop mid-cycle | MQTT keepalive failure | Firmware continues current cycle locally (state machine doesn't depend on cloud), re-publishes state on reconnect |
