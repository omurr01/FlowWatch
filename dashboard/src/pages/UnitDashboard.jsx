// UnitDashboard — per-unit live view wiring all components together.
// FR-7: display live sensor data, actuator state, and connectivity status.
// RULES.md §1: components receive props — no component fetches or publishes directly.

import { useFlowWatchFeed } from '../hooks/useFlowWatchFeed.js'
import MetricCard       from '../components/MetricCard.jsx'
import LiveChart        from '../components/LiveChart.jsx'
import ControlButton    from '../components/ControlButton.jsx'
import ConnectivityBadge from '../components/ConnectivityBadge.jsx'
import EventLog         from '../components/EventLog.jsx'
import { TOKENS, THRESHOLDS, ACTUATOR_STATES } from '../constants.js'

// Derive ok/warn/danger tone for distance reading — DESIGN.md §3
function distanceTone(cm) {
  if (cm == null)                    return 'warn'
  if (cm < THRESHOLDS.BLOCKAGE_CM)  return 'danger'
  if (cm < THRESHOLDS.BLOCKAGE_CM + 4) return 'warn'
  return 'ok'
}

// Derive tone for water level reading
function waterTone(cm) {
  if (cm == null)                  return 'warn'
  if (cm > THRESHOLDS.FLOOD_CM)   return 'danger'
  if (cm > THRESHOLDS.FLOOD_CM - 4) return 'warn'
  return 'ok'
}

// Human-readable label for actuator state
function actuatorLabel(state) {
  switch (state) {
    case ACTUATOR_STATES.STANDBY:     return 'Standby'
    case ACTUATOR_STATES.LIFTING:     return 'Lifting…'
    case ACTUATOR_STATES.FLIPPING:    return 'Flipping…'
    case ACTUATOR_STATES.LOWERING:    return 'Lowering…'
    case ACTUATOR_STATES.ALERT_FLOOD: return 'Flood Alert'
    case ACTUATOR_STATES.FAULT:       return 'FAULT'
    default:                          return state ?? '—'
  }
}

function actuatorTone(state) {
  if (state === ACTUATOR_STATES.STANDBY)     return 'ok'
  if (state === ACTUATOR_STATES.FAULT)       return 'danger'
  if (state === ACTUATOR_STATES.ALERT_FLOOD) return 'danger'
  return 'warn' // cycling states
}

/**
 * @param {string} props.unit - unit ID, e.g. 'unit1'
 */
export default function UnitDashboard({ unit }) {
  const { state, publish } = useFlowWatchFeed(unit)

  const {
    distanceCm, waterLevelCm, actuatorState,
    wifiConnected, isCycling, brokerConnected, brokerError,
  } = state

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <h1 style={{ color: TOKENS.text, fontSize: 20, fontWeight: 700, margin: 0 }}>
          FlowWatch — <span style={{ color: TOKENS.accent }}>{unit}</span>
        </h1>
        <ConnectivityBadge
          brokerConnected={brokerConnected}
          wifiConnected={wifiConnected}
          brokerError={brokerError}
        />
      </div>

      {/* Metric row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <MetricCard
          label="Distance (ultrasonic)"
          value={distanceCm}
          unit="cm"
          tone={distanceTone(distanceCm)}
          detail={distanceCm != null && distanceCm < THRESHOLDS.BLOCKAGE_CM
            ? 'Blockage threshold crossed'
            : `Threshold: ${THRESHOLDS.BLOCKAGE_CM} cm`}
        />
        <MetricCard
          label="Water Level"
          value={waterLevelCm}
          unit="cm"
          tone={waterTone(waterLevelCm)}
          detail={waterLevelCm != null && waterLevelCm > THRESHOLDS.FLOOD_CM
            ? 'Flood threshold crossed'
            : `Threshold: ${THRESHOLDS.FLOOD_CM} cm`}
        />
        <MetricCard
          label="Actuator State"
          value={null}
          unit=""
          displayValue={actuatorLabel(actuatorState)}
          tone={actuatorTone(actuatorState)}
          detail={isCycling ? 'Removal cycle in progress' : 'Ready'}
        />
      </div>

      {/* Chart */}
      <div style={{ marginBottom: 20 }}>
        <LiveChart unit={unit} />
      </div>

      {/* Control + Event log side by side on wider screens */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ControlButton
            unit={unit}
            isCycling={isCycling}
            actuatorState={actuatorState}
            publish={publish}
          />
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <EventLog unit={unit} />
        </div>
      </div>

    </div>
  )
}
