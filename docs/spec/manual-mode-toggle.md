# Manual Mode Toggle

## Problem Statement

FlowWatch's "manual override" was renamed to "Manual Mode" across the MQTT topics, event vocabulary, and code — the naming now matches the domain model in `CONTEXT.md`. But the **behavior** behind that name is still the old one-shot model: the dashboard `ControlButton` sends a single `activate` message that tells the unit to run one removal cycle, and nothing models the fact that Manual Mode is supposed to be a *mode* (a state the unit stays in until the operator releases it). The operator has no way to enter Manual Mode and have it persist, no visible indication the unit is actually in Manual Mode, and no path back to automatic operation. Meanwhile the pipeline and mock already partially speak the "mode" language (two event types exist), but the pieces don't line up into a coherent toggle.

The domain decision (recorded in `CONTEXT.md` and `docs/adr/0001-rename-override-to-manual-mode.md`) is unambiguous: Manual Mode is a toggle — the operator enters it, automatic blockage-triggered cycles are suppressed, alerts are still logged but not acted on, and the operator explicitly releases it to return to automatic operation. The code does not yet implement this.

## Solution

Make Manual Mode a real toggle across the whole path:

- The operator clicks **Enter Manual Mode** to activate it and **Return to Auto** to release it. The dashboard shows whether the unit is in Manual Mode at all times.
- While Manual Mode is active, automatic blockage-triggered cycles are suppressed; alerts are still logged.
- The `control/manual` topic carries `activate` and `release` actions. Activating or releasing is recorded as an `event_type` (`manual_mode_activated` / `manual_mode_released`) with a timestamp.
- The mock unit (standing in for firmware) honors the mode: it suppresses its own automatic cycle on blockage while in Manual Mode, and triggers a cycle when Manual Mode is activated.

## User Stories

1. As a field operator, I want a **Enter Manual Mode** button that activates manual mode, so that I can take direct control of a unit.
2. As a field operator, I want a **Return to Auto** button that releases manual mode, so that I can hand control back to the automatic system.
3. As a field operator, I want clear, visible indication that a unit is currently in Manual Mode, so that I never mistake a manually-controlled unit for an automatic one.
4. As a field operator, I want the Manual Mode button disabled while a removal cycle is running, so that I cannot issue a conflicting command mid-cycle.
5. As a field operator, I want the Manual Mode button disabled while the unit is in a fault state, so that I cannot operate a unit that needs service first.
6. As a field operator, I want activating Manual Mode to be recorded as a `manual_mode_activated` event, so that there is an audit trail of when manual control was taken.
7. As a field operator, I want releasing Manual Mode to be recorded as a `manual_mode_released` event, so that there is an audit trail of when control returned to automatic.
8. As a maintenance technician, I want to see `manual_mode_activated` and `manual_mode_released` events in the event log, so that I can reconstruct exactly when and how a unit was operated.
9. As a field operator, I want alerts (blockage, flood, fault) to continue to be logged while Manual Mode is active, so that I still see everything that is happening even under manual control.
10. As a field operator, I want automatic blockage-triggered cycles to be suppressed while Manual Mode is active, so that the unit does not act on its own while I am in control.
11. As a field operator, I want pressing **Enter Manual Mode** to trigger one removal cycle immediately, so that I can clear debris on demand the moment I take control.
12. As a developer, I want the Manual Mode state to be exposed by the dashboard data feed, so that the UI can render the toggle state from a single source of truth.
13. As a developer, I want the `control/manual` payload to carry a `requested_by` identity, so that the audit trail records who issued the command.
14. As a developer, I want a single `control/manual` topic (no separate activate/release topics), so that the schema stays minimal and one subscribe covers the whole feature.
15. As the fleet administrator, I want Manual Mode status reflected per unit in the dashboard rather than fleet-wide, so that one manually-controlled unit never affects the display or control of other units.

## Implementation Decisions

### Manual Mode is a per-unit toggle
Manual Mode state is tracked per unit, never fleet-wide. One unit being in Manual Mode has no effect on any other unit's control or display (matches `CONTEXT.md` — units are independent).

### MQTT contract (schema)
The `flowwatch/{unit}/control/manual` topic carries two actions:

```
{ "action": "activate" | "release", "requested_by": string, "ts": iso8601 }
```

- `activate` enters Manual Mode (implicitly triggering one removal cycle, matching current `ControlButton` behavior).
- `release` returns the unit to automatic operation.
- The payload already carries `requested_by` (identity of the issuer) and `ts` (the authoritative device-clock timestamp), per the existing rule that every payload carries its own `ts`.

No schema change beyond what already exists — `SCHEMA.md §1` already documents `activate | release`, and `§4` already lists both event types.

### Dashboard seam: `useFlowWatchFeed` exposes `manualModeActive`
The existing `useFlowWatchFeed` hook (the single file that touches `mqtt.js`, per `RULES.md §1` dependency inversion) is the highest seam. It will:

- Track whether the unit is in Manual Mode in its returned state object (`manualModeActive: boolean`, default `false`).
- Track where Manual Mode state comes from. The unit reports its live actuator state via `status/actuator`; Manual Mode active/released is driven by the commands this dashboard sends, but the authoritative source is the unit's own reported state. The hook should derive `manualModeActive` so it reflects the unit's truth, not just the dashboard's last click. Where the unit does not yet publish a distinct "manual" status field, derive it from the transition events the dashboard observes, and treat the retained status/actuator payload as the source when it carries the mode.

The `publish` callback stays the single publish path; `ControlButton` (and any future control UI) continues to receive it as a prop and never calls `mqtt.js` directly.

### Dashboard seam: `ControlButton` becomes a toggle
`ControlButton` will render two states based on `manualModeActive` from the hook:

- In **Auto**: label **Enter Manual Mode**, enabled when not cycling and not in fault.
- In **Manual**: label **Return to Auto**, enabled when not cycling and not in fault.

`handleClick` publishes `action: 'activate'` when entering and `action: 'release'` when leaving. The button remains disabled while a cycle is running or the unit is in fault (`DESIGN.md §3`), so no command can be sent mid-cycle. A clear `warn`-tone visual and label distinguish Manual Mode from Auto, so the operator can never mistake one for the other (accessible: tone plus text, never color alone, per `DESIGN.md §4`).

### Pipeline seam: Node-RED already routes both events
The Node-RED control branch already maps `action === 'release'` to `manual_mode_released` and otherwise to `manual_mode_activated`, and inserts them into the `events` table. This seam is complete for the feature; no changes are expected unless the hook's derivation of `manualModeActive` requires a corresponding change downstream. The pipeline continues to log both transitions so the event log is the audit trail.

### Mock seam: `mock_publisher` models Manual Mode as a mode
The Python mock (ESP32 simulator) will:

- Maintain a per-unit `manual_mode` boolean instead of a one-shot `force_cycle` flag.
- On `activate`: set `manual_mode = True` and start a removal cycle immediately.
- On `release`: set `manual_mode = False`.
- While `manual_mode` is True, **suppress** the automatic blockage-triggered cycle start (blockages still publish their alert, but do not auto-start a cycle) — this is the observable suppression the domain model promises.
- Keep publishing `status/actuator` so the dashboard can observe live state even during the mock.

This makes the mock a faithful stand-in for the firmware's Manual Mode behavior and lets the dashboard toggle be validated end-to-end before hardware exists.

### Terminology throughout
All code, comments, and messages use **Manual Mode** / **Enter Manual Mode** / **Return to Auto**. The terms "override" (in the manual-mode sense) and "trigger cycle" as the sole button meaning are retired. This matches `CONTEXT.md` and ADR 0001.

## Testing Decisions

A good test exercises external behavior, not implementation details: it checks that an operator entering and releasing Manual Mode produces the right command and observable state, and that the mock suppresses automatic cycles while in Manual Mode — never that a particular function was called or a particular state field was set internally.

The tested seams:

- **Dashboard hook + ControlButton**: assert that with the unit reported in Auto, the control publishes `activate`; with the unit reported in Manual, it publishes `release`; that the feed exposes `manualModeActive` reflecting the unit's reported state; and that the button disables while cycling or in fault.
- **Mock publisher**: assert that receiving `activate` sets Manual Mode and starts one cycle; that a subsequent blockage alert while in Manual Mode does not auto-start another cycle; that `release` clears Manual Mode and restores auto-start behavior.

Prior art: the project has no test harness wired yet (this is a software-first build validated against mock data, per `SPRINT.md`). The first tests will establish the harness. Where possible, prefer integration-style tests that drive the real `useFlowWatchFeed` publish path through `mqtt.js` against a local broker (the exits already run against Mosquitto), and test the mock by importing its message-handling logic with injected MQTT client fakes. Manual verification against the running Docker stack (Mosquitto + Node-RED + MySQL + mock) remains the acceptance gate for the end-to-end event log.

## Out of Scope

- **Firmware implementation** (real ESP32 Manual Mode behavior) — this is Sprint 3 work (`SPRINT.md`); the mock stands in for it here.
- **Additional control capabilities** — e.g., pausing a running cycle, stepping an actuator, or setting thresholds from the dashboard.
- **Site/fleet-level Manual Mode views** — the current dashboard is per-unit; fleet aggregation is a later concern.
- **Coordinated / multi-unit control** — units remain independent.
- **Persistence of Manual Mode across device reboot** — the domain model notes a unit might latch Manual Mode, but this is not required for the dashboard toggle feature.

## Further Notes

- The vocabulary cleanup (topics, event types, docs) was completed in this session; this spec is the behavioral counterpart that makes the renamed feature actually a toggle.
- `CONTEXT.md` and `docs/adr/0001-rename-override-to-manual-mode.md` are the authoritative domain references for what Manual Mode means.
- Rereading `DESIGN.md §3` before touching `ControlButton` will keep the disable-while-cycling rule intact.
