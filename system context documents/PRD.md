# FlowWatch — Product Requirements Document

> Related docs: `ARCHITECTURE.md` (how it's built) · `SCHEMA.md` (data contracts) · `SPRINT.md` (delivery order)
> This file is the source of truth for *what* and *why*. Do not restate requirements in other docs — reference the FR/NFR ID instead.

## 1. Problem

Manual drainage clearing is reactive and hazardous — blockages cause localized flooding before anyone notices. FlowWatch detects blockage and flood risk in a drainage channel, clears debris automatically, and gives an operator live remote visibility plus manual mode control, without needing anyone on-site.

## 2. Users

| User | Need |
|---|---|
| Fleet administrator | Manage sites and units, view status across the whole fleet |
| Field operator | Monitor status remotely across sites, receive alerts, trigger a cycle manually if needed |
| Maintenance technician | Diagnose faults on-site using event history, service the physical unit |

## 3. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Detect waste accumulation via ultrasonic distance sensing | Must |
| FR-2 | Detect rising water level independently of blockage detection | Must |
| FR-3 | Automatically run a lift → flip → lower removal cycle on blockage detection | Must |
| FR-4 | Display live and confirm removal visually via camera snapshot on cycle completion | Should |
| FR-5 | Publish live sensor + state data to the cloud over MQTT | Must |
| FR-6 | Accept a remote manual-mode command to activate or release operator control, triggering a cycle on demand | Must |
| FR-7 | Display live sensor data, actuator state, and connectivity status on a dashboard reachable from anywhere | Must |
| FR-8 | Log discrete events (blockage detected, cycle complete, alerts, faults) with timestamps | Must |
| FR-9 | Send an SMS alert via GSM when Wi-Fi/cloud connectivity is unavailable | Must |
| FR-10 | Halt actuator motion and flag a fault on overcurrent, jam, or limit-switch timeout | Must |
| FR-11 | Support multiple units grouped under multiple sites, with a fleet-level view summarizing status across all sites | Must |
| FR-12 | Allow drilling down from the fleet view into a single site/unit's live dashboard (per-unit view from earlier scope) | Must |

## 4. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Latency | Remote command → physical actuation | < 2 s on stable Wi-Fi |
| Reliability | System uptime during trial period | ≥ 95% |
| Reliability | Blockage detection accuracy (bench trials) | ≥ 90% over 10+ trials per condition |
| Security | All device↔cloud traffic | TLS-encrypted, scoped credentials (see `ARCHITECTURE.md` §4) |
| Security | Dashboard client never holds broker admin credentials | Enforced via ACL, no exceptions |
| Maintainability | Firmware and dashboard follow `RULES.md` without exception | Code review gate |
| Portability | Cloud stack must run identically on any Docker host | Self-hosted VPS, no vendor lock-in |
| Fallback | Alerting must survive total Wi-Fi/cloud outage | GSM/SMS path (FR-9) is independent of MQTT stack |
| Scalability | Fleet dashboard query performance | Fleet-level summary view loads in < 3 s at up to 50 units across 10 sites |

## 5. Out of Scope (v1)

- User account management / multi-tenant auth — single shared operator credential is acceptable for v1, across the whole fleet
- ML-based predictive blockage forecasting
- Native mobile app — the web dashboard must be responsive instead
- Billing/subscription management across sites

## 6. Success Metrics

- ≥ 90% correct blockage-triggered cycle activation across bench trials
- ≥ 95% of alerts (MQTT or SMS) delivered within 5 seconds of the triggering event
- Zero unrecovered actuator faults during a 48-hour continuous soak test
- Dashboard usable (task completion, no confusion) by an evaluator unfamiliar with the system, per your ISO/IEC 25010 usability instrument
- A fleet administrator can onboard a new site/unit in a single session, no engineering support needed
- Fleet-level view correctly aggregates status across all sites with no missing/misattributed units
