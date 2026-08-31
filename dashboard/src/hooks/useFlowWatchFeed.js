// useFlowWatchFeed — the ONLY file that touches mqtt.js (RULES.md §1 DIP)
// Connects over WebSocket to Mosquitto, subscribes to all topics for the given
// unit, and returns a stable state object that components consume as props.
// ARCHITECTURE.md §2: dashboard uses WebSocket (port 9001), not direct DB access.

import { useEffect, useRef, useState, useCallback } from 'react'
import mqtt from 'mqtt'
import {
  MQTT_WS_URL,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  TOPICS,
  ACTUATOR_STATES,
  CYCLING_STATES,
} from '../constants.js'

// Shape returned to consumers — all fields have safe defaults so components
// never have to null-check individually. (RULES.md §1 LSP: mock feed must
// expose the same shape — see useSimulatedFeed.js for Sprint 0 fallback.)
const initialState = (unit) => ({
  unit,
  // Sensor readings
  distanceCm: null,       // float | null
  waterLevelCm: null,     // float | null
  // Actuator state (SCHEMA.md §1 status/actuator)
  actuatorState: ACTUATOR_STATES.STANDBY,
  // Connectivity (SCHEMA.md §1 status/connectivity)
  wifiConnected: null,    // bool | null (null = not yet received)
  // Derived: is a removal cycle currently running?
  isCycling: false,
  // Latest alert timestamps (ISO string | null)
  lastBlockageTs: null,
  lastFloodTs: null,
  lastFaultCode: null,
  lastFaultDetail: null,
  // Broker connection status
  brokerConnected: false,
  brokerError: null,
})

/**
 * @param {string} unit  - unit ID, e.g. 'unit1'
 * @returns {{ state, publish }} where publish(topic, payload) sends a message
 */
export function useFlowWatchFeed(unit) {
  const [state, setState] = useState(() => initialState(unit))
  const clientRef = useRef(null)

  // Stable publish callback so ControlButton doesn't re-render on every tick
  const publish = useCallback((topic, payload) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(topic, JSON.stringify(payload), { qos: 1 })
    }
  }, [])

  useEffect(() => {
    const clientId = `dashboard-${unit}-${Math.random().toString(16).slice(2, 8)}`

    const client = mqtt.connect(MQTT_WS_URL, {
      clientId,
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 3000,
    })
    clientRef.current = client

    client.on('connect', () => {
      setState((s) => ({ ...s, brokerConnected: true, brokerError: null }))
      // Subscribe to all topics for this unit — ARCHITECTURE.md §4
      client.subscribe(TOPICS.allUnit(unit), { qos: 1 })
    })

    client.on('disconnect', () => {
      setState((s) => ({ ...s, brokerConnected: false }))
    })

    client.on('error', (err) => {
      setState((s) => ({ ...s, brokerError: err.message }))
    })

    client.on('message', (topic, raw) => {
      let payload
      try {
        payload = JSON.parse(raw.toString())
      } catch {
        return // malformed — ignore
      }

      setState((s) => {
        // Route by topic suffix — avoids hardcoded strings per RULES.md §2
        if (topic === TOPICS.sensorUltrasonic(unit)) {
          return { ...s, distanceCm: payload.cm }
        }
        if (topic === TOPICS.sensorWaterlevel(unit)) {
          return { ...s, waterLevelCm: payload.cm }
        }
        if (topic === TOPICS.statusActuator(unit)) {
          const actuatorState = payload.state ?? s.actuatorState
          return {
            ...s,
            actuatorState,
            isCycling: CYCLING_STATES.has(actuatorState),
          }
        }
        if (topic === TOPICS.statusConnectivity(unit)) {
          return { ...s, wifiConnected: payload.wifi }
        }
        if (topic === TOPICS.alertBlockage(unit)) {
          return { ...s, lastBlockageTs: payload.ts }
        }
        if (topic === TOPICS.alertFlood(unit)) {
          return { ...s, lastFloodTs: payload.ts }
        }
        if (topic === TOPICS.alertFault(unit)) {
          return { ...s, lastFaultCode: payload.code, lastFaultDetail: payload.detail }
        }
        return s
      })
    })

    // Reset state on unit change so stale data from old unit doesn't linger
    setState(initialState(unit))

    return () => {
      client.end(true)
      clientRef.current = null
    }
  }, [unit]) // re-subscribe when unit changes

  return { state, publish }
}
