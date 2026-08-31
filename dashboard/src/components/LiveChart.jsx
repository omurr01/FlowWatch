// LiveChart — rolling water-level history fetched from Node-RED HTTP endpoint.
// ARCHITECTURE.md §1: dashboard never queries InfluxDB directly — goes via Node-RED.
// DESIGN.md §2: pure display component, no state except fetched data.

import { useEffect, useState, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { TOKENS, THRESHOLDS } from '../constants.js'

const POLL_INTERVAL_MS = 5000
const HISTORY_LIMIT    = 30

function formatTs(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * @param {string} props.unit - unit ID, e.g. 'unit1'
 */
export default function LiveChart({ unit }) {
  const [points, setPoints]   = useState([])
  const [error, setError]     = useState(null)
  const intervalRef           = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/readings?unit=${unit}&measurement=waterlevel&limit=${HISTORY_LIMIT}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const rows = await res.json()
        if (!cancelled) {
          // Node-RED returns rows newest-first; reverse for chronological display
          const pts = [...rows].reverse().map((r) => ({
            ts:  r.ts ?? r._time,
            cm:  r.level_cm ?? r.cm,
            label: formatTs(r.ts ?? r._time),
          }))
          setPoints(pts)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    fetchHistory()
    intervalRef.current = setInterval(fetchHistory, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
    }
  }, [unit])

  return (
    <div
      style={{
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        padding: '16px 20px',
      }}
    >
      <div style={{ color: TOKENS.textMuted, fontSize: 12, marginBottom: 12 }}>
        Water Level — last {HISTORY_LIMIT} readings
      </div>

      {error && (
        <div style={{ color: TOKENS.warn, fontSize: 12, marginBottom: 8 }}>
          ⚠ Chart data unavailable: {error}
        </div>
      )}

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: TOKENS.textDim, fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: TOKENS.textDim, fontSize: 10 }}
            domain={['auto', 'auto']}
            unit=" cm"
          />
          <Tooltip
            contentStyle={{ background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, color: TOKENS.text }}
            formatter={(v) => [`${v.toFixed(1)} cm`, 'Level']}
          />
          {/* Flood threshold reference line — SCHEMA.md §5 */}
          <ReferenceLine
            y={THRESHOLDS.FLOOD_CM}
            stroke={TOKENS.danger}
            strokeDasharray="4 2"
            label={{ value: 'Flood', fill: TOKENS.danger, fontSize: 10, position: 'right' }}
          />
          <Line
            type="monotone"
            dataKey="cm"
            stroke={TOKENS.accent}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
