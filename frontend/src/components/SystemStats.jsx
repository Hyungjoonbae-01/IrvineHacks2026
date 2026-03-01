// src/components/SystemStats.jsx
import React, { useState, useEffect } from 'react'
import { Users, Brain, Gauge, ShieldAlert } from 'lucide-react' // or your icon library

function SystemStats() {
  const [stats, setStats] = useState([
    { label: 'Total Detected', value: '547', subtext: 'persons across all zones', icon: Users },
    { label: 'Overload Score', value: '64', subtext: 'cognitive load index', icon: Brain },
    { label: 'System Latency', value: '12ms', subtext: 'on-device inference', icon: Gauge },
    { label: 'Active Interventions', value: '2', subtext: 'zones in intervention', icon: ShieldAlert },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev =>
        prev.map(s => {
          if (s.label === 'Total Detected') return { ...s, value: `${520 + Math.floor(Math.random() * 60)}` }
          if (s.label === 'Overload Score') return { ...s, value: `${50 + Math.floor(Math.random() * 35)}` }
          if (s.label === 'System Latency') return { ...s, value: `${8 + Math.floor(Math.random() * 10)}ms` }
          return s
        })
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {stats.map(({ label, value, subtext, icon: Icon }) => (
        <div
          key={label}
          style={{
            backgroundColor: '#0f0f1a',
            border: '1px solid #2a2a3a',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              height: 36,
              width: 36,
              borderRadius: 6,
              backgroundColor: '#1e1e2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={18} color="#6ee7b7" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color: '#888',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: 18,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: '#f0f0f0',
                lineHeight: 1.2,
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#888',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtext}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default SystemStats