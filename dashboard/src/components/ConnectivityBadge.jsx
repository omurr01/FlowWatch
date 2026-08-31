// ConnectivityBadge — shows broker connection and device Wi-Fi/GSM state.
// DESIGN.md §3: GSM-fallback is danger tone, not neutral — primary path has failed.
// DESIGN.md §4: state is conveyed by icon + text, not color alone.

import { TOKENS } from '../constants.js'

/**
 * @param {boolean}      props.brokerConnected - WebSocket broker connection
 * @param {boolean|null} props.wifiConnected   - device Wi-Fi from status/connectivity
 * @param {string|null}  props.brokerError     - error message if connection failed
 */
export default function ConnectivityBadge({ brokerConnected, wifiConnected, brokerError }) {
  // Determine overall state
  let tone, icon, label, sublabel

  if (!brokerConnected) {
    tone     = 'danger'
    icon     = '✕'
    label    = 'Broker Disconnected'
    sublabel = brokerError ?? 'Attempting to reconnect…'
  } else if (wifiConnected === false) {
    // Device is online via GSM only — ARCHITECTURE.md §5 fallback path
    tone     = 'danger'
    icon     = '📵'
    label    = 'GSM Fallback'
    sublabel = 'Device Wi-Fi lost — SMS alert path active'
  } else if (wifiConnected === true) {
    tone     = 'ok'
    icon     = '✓'
    label    = 'Connected'
    sublabel = 'Wi-Fi + broker OK'
  } else {
    // null = retained status not yet received
    tone     = 'warn'
    icon     = '…'
    label    = 'Awaiting Status'
    sublabel = 'No connectivity message received'
  }

  const color = TOKENS[tone]

  return (
    <div
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            8,
        background:     TOKENS.surface,
        border:         `1px solid ${color}`,
        borderRadius:   6,
        padding:        '6px 12px',
      }}
      role="status"
      aria-label={`Connectivity: ${label} — ${sublabel}`}
    >
      <span style={{ color, fontSize: 16, lineHeight: 1 }} aria-hidden="true">
        {icon}
      </span>
      <div>
        <div style={{ color, fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ color: TOKENS.textDim, fontSize: 11 }}>{sublabel}</div>
      </div>
    </div>
  )
}
