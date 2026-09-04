// ControlButton — publishes control/manual to the broker.
// DESIGN.md §3: must disable the instant a cycle starts, re-enable only on STANDBY.
// Never allows queuing a second command mid-cycle — firmware doesn't support it.
// RULES.md §1: receives publish callback as prop, never calls mqtt.js directly.

import { TOKENS, TOPICS, ACTUATOR_STATES, EVENT_TYPES } from '../constants.js'

/**
 * @param {string}   props.unit       - unit ID
 * @param {boolean}  props.isCycling  - disables button when true
 * @param {string}   props.actuatorState - current actuator state string
 * @param {Function} props.publish    - (topic, payload) => void from useFlowWatchFeed
 */
export default function ControlButton({ unit, isCycling, actuatorState, publish }) {
  const isFault   = actuatorState === ACTUATOR_STATES.FAULT
  const disabled  = isCycling || isFault

  function handleClick() {
    if (disabled) return
    // SCHEMA.md §1: control/manual payload
    publish(TOPICS.controlManual(unit), {
      action:       'activate',
      requested_by: 'dashboard',
      ts:           new Date().toISOString(),
    })
  }

  let label, tone, detail
  if (isFault) {
    label  = 'Trigger Cycle'
    tone   = 'danger'
    detail = 'Fault — clear before cycling'
  } else if (isCycling) {
    label  = 'Cycle Running…'
    tone   = 'warn'
    detail = actuatorState
  } else {
    label  = 'Trigger Cycle'
    tone   = 'ok'
    detail = 'Manual mode'
  }

  const bg     = disabled ? TOKENS.surface  : TOKENS[tone]
  const color  = disabled ? TOKENS[tone]    : TOKENS.bg
  const border = `1px solid ${TOKENS[tone]}`

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={`${label}${disabled ? ` — ${detail}` : ''}`}
      style={{
        background:    bg,
        color:         color,
        border,
        borderRadius:  8,
        padding:       '12px 24px',
        fontSize:      14,
        fontWeight:    600,
        cursor:        disabled ? 'not-allowed' : 'pointer',
        opacity:       disabled ? 0.7 : 1,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           4,
        transition:    'opacity 0.15s',
        // Visible focus ring — DESIGN.md §4
        outline:       'none',
      }}
      onFocus={(e) => { e.target.style.boxShadow = `0 0 0 3px ${TOKENS[tone]}66` }}
      onBlur={(e)  => { e.target.style.boxShadow = 'none' }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 400, color: disabled ? TOKENS[tone] : `${TOKENS.bg}cc` }}>
        {detail}
      </span>
    </button>
  )
}
