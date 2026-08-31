// FlowWatch Dashboard — single source of truth for all magic strings and tokens
// Maps directly to SCHEMA.md §1, §4, §5 and DESIGN.md §1
// RULES.md §2: never retype these literals anywhere else — import from here.

// ---------------------------------------------------------------------------
// MQTT topic templates (SCHEMA.md §1)
// Call topic(unit, 'sensor/ultrasonic') → 'flowwatch/unit1/sensor/ultrasonic'
// ---------------------------------------------------------------------------
export const topic = (unit, path) => `flowwatch/${unit}/${path}`

export const TOPICS = {
  sensorUltrasonic: (unit) => topic(unit, 'sensor/ultrasonic'),
  sensorWaterlevel: (unit) => topic(unit, 'sensor/waterlevel'),
  statusActuator:   (unit) => topic(unit, 'status/actuator'),
  statusConnectivity: (unit) => topic(unit, 'status/connectivity'),
  alertBlockage:    (unit) => topic(unit, 'alert/blockage'),
  alertFlood:       (unit) => topic(unit, 'alert/flood'),
  alertFault:       (unit) => topic(unit, 'alert/fault'),
  controlOverride:  (unit) => topic(unit, 'control/override'),
  // Wildcard for subscribing to all unit topics
  allUnit:          (unit) => topic(unit, '#'),
}

// ---------------------------------------------------------------------------
// MQTT broker WebSocket endpoint (ARCHITECTURE.md §4 — WSS on 9001)
// In dev, connect to localhost; in prod, replace with VPS hostname.
// ---------------------------------------------------------------------------
export const MQTT_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:9001'
export const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME || 'dashboard'
export const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || 'flowwatch_dev_dashboard'

// ---------------------------------------------------------------------------
// Actuator states (SCHEMA.md §1 status/actuator)
// ---------------------------------------------------------------------------
export const ACTUATOR_STATES = {
  STANDBY:     'STANDBY',
  LIFTING:     'LIFTING',
  FLIPPING:    'FLIPPING',
  LOWERING:    'LOWERING',
  ALERT_FLOOD: 'ALERT_FLOOD',
  FAULT:       'FAULT',
}

export const CYCLING_STATES = new Set([
  ACTUATOR_STATES.LIFTING,
  ACTUATOR_STATES.FLIPPING,
  ACTUATOR_STATES.LOWERING,
])

// ---------------------------------------------------------------------------
// Event types (SCHEMA.md §4)
// ---------------------------------------------------------------------------
export const EVENT_TYPES = {
  BLOCKAGE_DETECTED:        'blockage_detected',
  CYCLE_COMPLETE:           'cycle_complete',
  FLOOD_ALERT:              'flood_alert',
  SMS_SENT:                 'sms_sent',
  FAULT:                    'fault',
  WIFI_LOST:                'wifi_lost',
  WIFI_RESTORED:            'wifi_restored',
  MANUAL_OVERRIDE_TRIGGERED:'manual_override_triggered',
}

// Severity mapping for EventLog row tones (DESIGN.md §2)
export const EVENT_SEVERITY = {
  [EVENT_TYPES.BLOCKAGE_DETECTED]:         'warn',
  [EVENT_TYPES.CYCLE_COMPLETE]:            'ok',
  [EVENT_TYPES.FLOOD_ALERT]:               'danger',
  [EVENT_TYPES.SMS_SENT]:                  'warn',
  [EVENT_TYPES.FAULT]:                     'danger',
  [EVENT_TYPES.WIFI_LOST]:                 'danger',
  [EVENT_TYPES.WIFI_RESTORED]:             'ok',
  [EVENT_TYPES.MANUAL_OVERRIDE_TRIGGERED]: 'warn',
}

// ---------------------------------------------------------------------------
// Thresholds (SCHEMA.md §5 — must match config.h exactly)
// ---------------------------------------------------------------------------
export const THRESHOLDS = {
  BLOCKAGE_CM: 8.0,
  FLOOD_CM:    22.0,
}

// ---------------------------------------------------------------------------
// Design tokens (DESIGN.md §1)
// These match the CSS custom properties in index.css exactly.
// ---------------------------------------------------------------------------
export const TOKENS = {
  bg:        '#0B0F10',
  surface:   '#12181A',
  border:    '#223034',
  text:      '#E7EEEC',
  textMuted: '#7B928F',
  textDim:   '#5A6E6B',
  ok:        '#5DCAA5',
  warn:      '#EF9F27',
  danger:    '#E24B4A',
  accent:    '#378ADD',
}
