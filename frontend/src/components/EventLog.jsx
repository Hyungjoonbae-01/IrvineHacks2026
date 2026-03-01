import React, { useState, useEffect, useCallback } from 'react'

// Lucide icons (or your icon library)
import { AlertTriangle, ShieldCheck, Info, ArrowRight } from 'lucide-react'

const eventTemplates = [
  { level: 'critical', message: 'Cognitive overload detected', zone: 'Main Entrance' },
  { level: 'critical', message: 'Intervention mode triggered', zone: 'Main Entrance' },
  { level: 'warning', message: 'Density spike detected', zone: 'North Hall' },
  { level: 'warning', message: 'Erratic motion pattern', zone: 'Food Court Area' },
  { level: 'warning', message: 'Stop-and-go flow detected', zone: 'North Hall' },
  { level: 'info', message: 'Crowd density stabilizing', zone: 'South Exit Corridor' },
  { level: 'info', message: 'Normal flow restored', zone: 'West Parking Ramp' },
  { level: 'info', message: 'Guidance relaxed to passive', zone: 'South Exit Corridor' },
  { level: 'warning', message: 'Temperature anomaly', zone: 'Food Court Area' },
  { level: 'info', message: 'Sensor calibration complete', zone: 'All Zones' },
]

function getEventIcon(level) {
  if (level === 'critical') return <AlertTriangle size={14} color='#f87171' />
  if (level === 'warning') return <AlertTriangle size={14} color='#fbbf24' />
  return <Info size={14} color='#6ee7b7' />
}

function getEventBg(level) {
  if (level === 'critical') return { backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }
  if (level === 'warning') return { backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }
  return { backgroundColor: 'rgba(52,211,153,0.05)', border: '1px solid #2a2a3a' }
}

function EventLog() {
  const [events, setEvents] = useState([])

  const addEvent = useCallback(() => {
    const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)]
    const now = new Date()
    const newEvent = {
      id: Math.random().toString(36).slice(2),
      level: template.level,
      message: template.message,
      time: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      zone: template.zone,
    }
    setEvents(prev => [newEvent, ...prev.slice(0, 19)])
  }, [])

  useEffect(() => {
    for (let i = 0; i < 6; i++) setTimeout(() => addEvent(), i * 100)
    const interval = setInterval(addEvent, 4000)
    return () => clearInterval(interval)
  }, [addEvent])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: '#0f0f1a', borderRadius: 8, border: '1px solid #2a2a3a', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid #2a2a3a', backgroundColor: '#0a0a14'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={14} color='#888' />
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>
            Event Log
          </span>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>REAL-TIME</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map(event => (
          <div key={event.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '8px 12px', borderRadius: 6, ...getEventBg(event.level)
          }}>
            {getEventIcon(event.level)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#f0f0f0', display: 'block' }}>
                {event.message}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>{event.time}</span>
                <ArrowRight size={10} color='#888' />
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>{event.zone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default EventLog