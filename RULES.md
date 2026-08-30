# FlowWatch — Coding Rules

> This file governs *how* code gets written, in both firmware and dashboard. It is binding — code review rejects anything that violates it. Read only the section relevant to the file you're touching; don't load the whole repo's context for a one-file change (see §5).

## 1. SOLID, applied concretely (not abstractly)

Embedded C++ doesn't need textbook class hierarchies. Apply SOLID as these concrete rules instead:

| Principle | Firmware rule | Dashboard rule |
|---|---|---|
| **S**ingle responsibility | One `.cpp`/`.h` pair per concern: `sensors.cpp`, `actuators.cpp`, `mqtt_client.cpp`, `state_machine.cpp`. The state machine never reads a raw pin directly — it calls `sensors::readDistance()`. | One component per concern: `MetricCard`, `LiveChart`, `ControlButton` never fetch data themselves — a parent passes props down. |
| **O**pen/closed | New sensor type = new file implementing the existing `Sensor` read interface, zero edits to `state_machine.cpp`. | New metric card = new data prop + threshold config, zero edits to `MetricCard`'s render logic. |
| **L**iskov substitution | Any function taking a `Sensor*` must work identically whether it's the real ultrasonic driver or a mock used in bench tests. | The real MQTT client and the Sprint 0 mock feed (`useSimulatedFeed`) must expose the identical shape of state to components — swapping one for the other requires no component changes. |
| **I**nterface segregation | `mqtt_client.h` exposes `publish()`/`subscribe()` only — never leaks broker connection internals to `state_machine.cpp`. | A component that only displays data never receives a `publish` callback it doesn't use. |
| **D**ependency inversion | `state_machine.cpp` depends on the `Sensor`/`Actuator` interfaces, not concrete driver classes — drivers are injected at `setup()`. | Components depend on a data-shape contract (see `SCHEMA.md`), not on `mqtt.js` directly — isolate the MQTT connection in one hook (`useFlowWatchFeed`), never call `mqtt.connect` from inside a UI component. |

## 2. DRY — one source of truth per fact

- **Thresholds, topic names, event-type strings, fault codes**: defined exactly once, in `SCHEMA.md` and the corresponding `config.h` / `constants.js`. Every other file imports/references — never retypes a literal.
- If you're about to write `"blockage_detected"` (or any topic string, threshold number, or fault code) as a string literal anywhere outside `config.h`/`constants.js`, stop — import the constant instead.
- Firmware and dashboard threshold values must match `SCHEMA.md` §5 exactly. If you need a different value during testing, change it in `SCHEMA.md` first, then propagate.

## 3. KISS — bias toward the boring solution

- The removal cycle is a **flat state machine** (`STANDBY → LIFTING → FLIPPING → LOWERING`), not a class hierarchy of Cycle/Phase objects. Don't add abstraction layers the current requirement doesn't need — `PRD.md` has no requirement that justifies a plugin architecture for cycle types.
- Dashboard state lives in plain React state/hooks. Don't reach for Redux/Zustand/context-provider trees until you have a concrete cross-tree state-sharing problem, not in anticipation of one.
- Node-RED flows: prefer a short linear flow with clear node names over deeply nested subflows. A flow a new contributor can't read top-to-bottom in under a minute is too clever.
- If two implementations both satisfy the requirement, ship the one with fewer moving parts.

## 4. Naming & structure

```
firmware/
  src/
    sensors.cpp / sensors.h
    actuators.cpp / actuators.h
    mqtt_client.cpp / mqtt_client.h
    state_machine.cpp / state_machine.h
    config.h              # SCHEMA.md §5 — thresholds, timeouts, pins
  test/                    # bench-mode mocks, one per Sensor/Actuator

dashboard/
  src/
    hooks/useFlowWatchFeed.js   # the ONLY file that touches mqtt.js
    components/                # one file per component, matches DESIGN.md §2
    constants.js                # SCHEMA.md topic names, DESIGN.md tokens
```

- File names: `snake_case.cpp` (firmware), `PascalCase.jsx` for components / `camelCase.js` for hooks/utils (dashboard).
- MQTT topic, event, and fault strings: always the literal values from `SCHEMA.md` — no paraphrasing, no abbreviating.

## 5. Token-efficiency guidance (for AI-assisted development)

- Load only the doc relevant to the current task: firmware work → `ARCHITECTURE.md` §1/§3 + `SCHEMA.md` §1/§5 + this file §1 (firmware column) + §4. Dashboard work → `DESIGN.md` + `SCHEMA.md` §1 + this file §1 (dashboard column).
- Don't paste full file contents into a prompt when a targeted diff or function will do.
- When generating new code, cite which `SCHEMA.md` entry or `PRD.md` FR it implements in a one-line comment — this keeps review fast and avoids re-deriving intent from the code later.
- Prefer extending an existing file that already owns a concern (per §4's structure) over creating a new one — fewer files to hold in context.
