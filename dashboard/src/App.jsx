// App — top-level shell. Renders the unit dashboard.
// Unit selector lets operator switch between unit1 / unit2 without reload.

import { useState } from 'react'
import UnitDashboard from './pages/UnitDashboard.jsx'
import { TOKENS } from './constants.js'

const UNITS = ['unit1', 'unit2']

export default function App() {
  const [activeUnit, setActiveUnit] = useState(UNITS[0])

  return (
    <div style={{ minHeight: '100vh', background: TOKENS.bg, color: TOKENS.text }}>
      {/* Unit tab bar */}
      <nav
        style={{
          background:   TOKENS.surface,
          borderBottom: `1px solid ${TOKENS.border}`,
          padding:      '0 28px',
          display:      'flex',
          gap:          4,
        }}
        aria-label="Unit selection"
      >
        {UNITS.map((u) => {
          const active = u === activeUnit
          return (
            <button
              key={u}
              onClick={() => setActiveUnit(u)}
              aria-current={active ? 'page' : undefined}
              style={{
                background:   'none',
                border:       'none',
                borderBottom: active ? `2px solid ${TOKENS.accent}` : '2px solid transparent',
                color:        active ? TOKENS.text : TOKENS.textMuted,
                cursor:       'pointer',
                padding:      '12px 16px',
                fontSize:     13,
                fontWeight:   active ? 600 : 400,
                // Visible focus ring — DESIGN.md §4
                outline:      'none',
              }}
              onFocus={(e) => { e.target.style.boxShadow = `0 0 0 2px ${TOKENS.accent}66` }}
              onBlur={(e)  => { e.target.style.boxShadow = 'none' }}
            >
              {u}
            </button>
          )
        })}
      </nav>

      <UnitDashboard unit={activeUnit} />
    </div>
  )
}
