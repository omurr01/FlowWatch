# FlowWatch — Dashboard Design

> Related docs: `SCHEMA.md` (what data drives each component) · `RULES.md` (component code conventions)
> This file is the source of truth for visual tokens and component states. Don't hardcode colors/spacing in components — reference tokens by name.

## 1. Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0F10` | Page background |
| `--surface` | `#12181A` | Card background |
| `--border` | `#223034` | Card border |
| `--text` | `#E7EEEC` | Primary text |
| `--text-muted` | `#7B928F` | Labels, captions |
| `--text-dim` | `#5A6E6B` | Timestamps, secondary meta |
| `--ok` | `#5DCAA5` | Normal/healthy state |
| `--warn` | `#EF9F27` | Cycle running, non-critical |
| `--danger` | `#E24B4A` | Blockage/flood risk, fault, disconnected |
| `--accent` | `#378ADD` | Chart line, informational highlight |

Typography: system UI stack (`Inter`/`Segoe UI`/system-ui). This is an operator utility tool, not a marketing surface — legibility and scan speed beat personality here. Numeric values use tabular figures (`font-variant-numeric: tabular-nums`) so live-updating numbers don't jitter the layout.

## 2. Component inventory

| Component | Data source (SCHEMA.md) | States |
|---|---|---|
| `MetricCard` | any sensor topic | ok / warn / danger, driven by threshold comparison, never hardcoded per-instance |
| `LiveChart` | `waterlevel` history | rolling window, no state — pure display |
| `ControlButton` | publishes `control/manual` | idle / disabled-while-cycling — never allow a second command mid-cycle |
| `ConnectivityBadge` | `status/connectivity` | connected / gsm-fallback |
| `EventLog` | MySQL events via Node-RED endpoint | ok / warn / danger row tone, matches `event_type` (SCHEMA.md §4) |

## 3. Interaction rules

- `ControlButton` **must** disable itself the instant a cycle starts and re-enable only on `STANDBY`. Never allow queuing a second command — the firmware state machine doesn't support it and won't acknowledge one.
- `ConnectivityBadge` switching to GSM fallback is a **danger**-tone state, not neutral — it means the primary path failed, even though the fallback is working as designed.
- Threshold-crossing (blockage/flood) recolors the relevant `MetricCard` immediately; it does not wait for a confirmed alert event to be logged.
- Every state a component can be in must map to one of `--ok` / `--warn` / `--danger` — no ad-hoc colors introduced per-component.

## 4. Accessibility floor

- All status conveyed by color also has an icon or text label — never color alone.
- Interactive elements have visible keyboard focus states.
- Minimum contrast: body text against `--surface` must pass WCAG AA.
