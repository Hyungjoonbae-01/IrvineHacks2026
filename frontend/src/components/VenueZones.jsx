import React, { useState, useEffect, useCallback } from 'react'

// Lucide icons (or your icon library)
import { ChevronUp, ChevronDown, ArrowUpRight, ArrowDownRight, Users, Thermometer, Volume2, Zap } from 'lucide-react'

function getStatusColor(status) {
  if (status === 'critical') return '#f87171'
  if (status === 'elevated') return '#fbbf24'
  return '#6ee7b7'
}

function ZoneCard({ zone }) {
  const [expanded, setExpanded] = useState(false)
  const color = getStatusColor(zone.status)

  return (
    <div style={{ border: '1px solid #2a2a3a', borderRadius: 8, backgroundColor: '#0f0f1a', overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            height: 10, width: 10, borderRadius: '50%',
            backgroundColor: color, display: 'inline-block', flexShrink: 0
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>{zone.name}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase', color }}>{zone.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#f0f0f0' }}>{zone.density}%</span>
            <span style={{ fontSize: 10, color: '#888', fontFamily: 'monospace' }}>DENSITY</span>
          </div>
          {expanded ? <ChevronUp size={16} color='#888' /> : <ChevronDown size={16} color='#888' />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #2a2a3a', padding: '12px 16px', backgroundColor: '#0a0a14' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>Crowd Density</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>{zone.density}/100</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, backgroundColor: '#1e1e2e', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${zone.density}%`, backgroundColor: color, borderRadius: 3, transition: 'width 0.7s' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {zone.stats.map(stat => (
              <div key={stat.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                backgroundColor: '#1e1e2e', borderRadius: 4, padding: '8px 10px'
              }}>
                <stat.icon size={14} color='#888' />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: '#888', fontFamily: 'monospace' }}>{stat.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f0f0f0' }}>{stat.value}</span>
                    {stat.change > 0
                      ? <ArrowUpRight size={12} color='#f87171' />
                      : <ArrowDownRight size={12} color='#6ee7b7' />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VenueZones() {
  const [zones, setZones] = useState([])

  const generateZones = useCallback(() => [
    {
      id: 'main-entrance', name: 'Main Entrance', status: 'critical',
      density: 87 + Math.floor(Math.random() * 8),
      stats: [
        { label: 'PERSONS', value: `${180 + Math.floor(Math.random() * 30)}`, change: 1, icon: Users },
        { label: 'TEMP', value: `${31 + Math.floor(Math.random() * 3)}°C`, change: 1, icon: Thermometer },
        { label: 'NOISE', value: `${78 + Math.floor(Math.random() * 10)} dB`, change: 1, icon: Volume2 },
        { label: 'MOTION', value: 'Erratic', change: 1, icon: Zap },
      ],
    },
    {
      id: 'north-hall', name: 'North Hall', status: 'elevated',
      density: 62 + Math.floor(Math.random() * 10),
      stats: [
        { label: 'PERSONS', value: `${120 + Math.floor(Math.random() * 20)}`, change: 1, icon: Users },
        { label: 'TEMP', value: `${28 + Math.floor(Math.random() * 2)}°C`, change: -1, icon: Thermometer },
        { label: 'NOISE', value: `${65 + Math.floor(Math.random() * 8)} dB`, change: 1, icon: Volume2 },
        { label: 'MOTION', value: 'Stop-Go', change: 1, icon: Zap },
      ],
    },
    {
      id: 'south-exit', name: 'South Exit Corridor', status: 'normal',
      density: 34 + Math.floor(Math.random() * 8),
      stats: [
        { label: 'PERSONS', value: `${45 + Math.floor(Math.random() * 15)}`, change: -1, icon: Users },
        { label: 'TEMP', value: `${25 + Math.floor(Math.random() * 2)}°C`, change: -1, icon: Thermometer },
        { label: 'NOISE', value: `${42 + Math.floor(Math.random() * 5)} dB`, change: -1, icon: Volume2 },
        { label: 'MOTION', value: 'Steady', change: -1, icon: Zap },
      ],
    },
    {
      id: 'food-court', name: 'Food Court Area', status: 'elevated',
      density: 71 + Math.floor(Math.random() * 6),
      stats: [
        { label: 'PERSONS', value: `${155 + Math.floor(Math.random() * 15)}`, change: 1, icon: Users },
        { label: 'TEMP', value: `${30 + Math.floor(Math.random() * 2)}°C`, change: 1, icon: Thermometer },
        { label: 'NOISE', value: `${72 + Math.floor(Math.random() * 6)} dB`, change: -1, icon: Volume2 },
        { label: 'MOTION', value: 'Congested', change: 1, icon: Zap },
      ],
    },
    {
      id: 'parking-west', name: 'West Parking Ramp', status: 'normal',
      density: 22 + Math.floor(Math.random() * 8),
      stats: [
        { label: 'PERSONS', value: `${30 + Math.floor(Math.random() * 10)}`, change: -1, icon: Users },
        { label: 'TEMP', value: `${24 + Math.floor(Math.random() * 2)}°C`, change: -1, icon: Thermometer },
        { label: 'NOISE', value: `${35 + Math.floor(Math.random() * 5)} dB`, change: -1, icon: Volume2 },
        { label: 'MOTION', value: 'Flowing', change: -1, icon: Zap },
      ],
    },
  ], [])

  useEffect(() => {
    setZones(generateZones())
    const interval = setInterval(() => setZones(generateZones()), 5000)
    return () => clearInterval(interval)
  }, [generateZones])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: '#0f0f1a', borderRadius: 8, border: '1px solid #2a2a3a', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid #2a2a3a', backgroundColor: '#0a0a14'
      }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>
          Venue Zones
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888' }}>{zones.length} Active</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {zones.map(zone => <ZoneCard key={zone.id} zone={zone} />)}
      </div>
    </div>
  )
}


export default VenueZones 