// MetricCard — displays a single sensor reading with ok/warn/danger state.
// DESIGN.md §2: state is driven by threshold comparison, never hardcoded per-instance.
// DESIGN.md §4: color is always accompanied by an icon (accessibility floor).

import { TOKENS } from '../constants.js'

const STATE_ICON = {
  ok:     '✓',
  warn:   '⚠',
  danger: '✕',
}

/**
 * @param {string}        props.label        - e.g. "Distance"
 * @param {number|null}   props.value        - raw numeric value (renders with .toFixed(1))
 * @param {string}        props.unit         - display unit, e.g. "cm"
 * @param {'ok'|'warn'|'danger'} props.tone  - visual state
 * @param {string}        [props.detail]     - optional sub-label or threshold note
 * @param {string}        [props.displayValue] - override rendered value (for non-numeric cards)
 */
export default function MetricCard({ label, value, unit, tone, detail, displayValue }) {
  const color = TOKENS[tone] ?? TOKENS.textMuted
  const icon  = STATE_ICON[tone] ?? ''

  const rendered = displayValue ?? (value != null ? value.toFixed(1) : '—')
  const ariaVal  = displayValue ?? (value != null ? `${value} ${unit}` : 'no data')

  return (
    <div
      style={{
        background: TOKENS.surface,
        border: `1px solid ${tone === 'ok' ? TOKENS.border : color}`,
        borderRadius: 8,
        padding: '16px 20px',
        minWidth: 140,
        flex: '1 1 140px',
      }}
      role="status"
      aria-label={`${label}: ${ariaVal}, status ${tone}`}
    >
      <div style={{ color: TOKENS.textMuted, fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          color,
          fontSize: 28,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {rendered}
        {!displayValue && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ color, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span aria-hidden="true">{icon}</span>
        <span>{detail ?? tone}</span>
      </div>
    </div>
  )
}
