import React, { useState, useEffect } from 'react'

// Lucide icons (or your icon library)
import { Shield, Activity, Wifi, Clock } from 'lucide-react'

function DashboardHeader() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid #2a2a3a', padding: '12px 24px',
      backgroundColor: '#0f0f1a'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Shield size={24} color='#6ee7b7' />
            <span style={{
              position: 'absolute', top: -2, right: -2, height: 8, width: 8,
              borderRadius: '50%', backgroundColor: '#6ee7b7', display: 'block'
            }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', fontFamily: 'monospace' }}>
            ClearPath
          </span>
        </div>
        <span style={{
          fontSize: 11, color: '#888', fontFamily: 'monospace',
          padding: '2px 8px', backgroundColor: '#1e1e2e', borderRadius: 4
        }}>v1.0.0</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {[
          { icon: <Activity size={14} color='#6ee7b7' />, label: 'EDGE AI ACTIVE' },
          { icon: <Wifi size={14} color='#6ee7b7' />, label: 'ON-DEVICE' },
        ].map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon}
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888' }}>{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={14} color='#888' />
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f0f0f0' }}>{time}</span>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader