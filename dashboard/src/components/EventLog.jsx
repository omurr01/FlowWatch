// EventLog — fetches discrete events from Node-RED HTTP endpoint and displays
// them as a scrollable list with per-row tone based on event_type.
// ARCHITECTURE.md §1: history always via Node-RED, never direct MySQL.
// DESIGN.md §2: row tone driven by EVENT_SEVERITY map in constants.js.

import { useEffect, useState, useRef } from 'react'
import { TOKENS, EVENT_SEVERITY } from '../constants.js'

const POLL_INTERVAL_MS = 8000
const EVENT_LIMIT      = 25

const TONE_ICON = { ok: '✓', warn: '⚠', danger: '✕' }

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleString([], {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/**
 * @param {string} props.unit - unit ID, e.g. 'unit1'. Pass null for fleet-wide.
 */
export default function EventLog({ unit }) {
  const [events, setEvents]   = useState([])
  const [error, setError]     = useState(null)
  const intervalRef           = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function fetchEvents() {
      try {
        const params = new URLSearchParams({ limit: EVENT_LIMIT })
        if (unit) params.set('unit', unit)
        const res = await fetch(`/api/events?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const rows = await res.json()
        if (!cancelled) {
          setEvents(rows)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    fetchEvents()
    intervalRef.current = setInterval(fetchEvents, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
    }
  }, [unit])

  return (
    <div
      style={{
        background:   TOKENS.surface,
        border:       `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        padding:      '16px 20px',
      }}
    >
      <div style={{ color: TOKENS.textMuted, fontSize: 12, marginBottom: 12 }}>
        Event Log {unit ? `— ${unit}` : '— fleet'}
      </div>

      {error && (
        <div style={{ color: TOKENS.warn, fontSize: 12, marginBottom: 8 }}>
          ⚠ Events unavailable: {error}
        </div>
      )}

      {events.length === 0 && !error && (
        <div style={{ color: TOKENS.textDim, fontSize: 12 }}>No events yet.</div>
      )}

      <ol
        style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflowY: 'auto' }}
        aria-label="Event log"
      >
        {events.map((ev, i) => {
          const tone  = EVENT_SEVERITY[ev.event_type] ?? 'ok'
          const color = TOKENS[tone]
          const icon  = TONE_ICON[tone]

          return (
            <li
              key={ev.id ?? i}
              style={{
                display:       'flex',
                alignItems:    'flex-start',
                gap:           8,
                padding:       '6px 0',
                borderBottom:  `1px solid ${TOKENS.border}`,
                fontSize:      13,
              }}
            >
              {/* Icon — always present alongside color per DESIGN.md §4 */}
              <span
                style={{ color, minWidth: 14, marginTop: 1 }}
                aria-hidden="true"
              >
                {icon}
              </span>

              <div style={{ flex: 1 }}>
                <span style={{ color, fontWeight: 600 }}>{ev.event_type}</span>
                {ev.detail && (
                  <span style={{ color: TOKENS.textMuted, marginLeft: 6 }}>
                    {ev.detail}
                  </span>
                )}
                <div style={{ color: TOKENS.textDim, fontSize: 11, marginTop: 2 }}>
                  {ev.unit_id && <span style={{ marginRight: 8 }}>{ev.unit_id}</span>}
                  <time dateTime={ev.created_at}>{formatDate(ev.created_at)}</time>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
