import React, { useEffect, useState, useRef } from 'react'
import { AlertTriangle, Activity, Gauge, Users, ShieldAlert } from 'lucide-react'
import SimulatedView from './SimulatedView'
import DroneCam from './DroneCam'
import InteractiveVideoFeed from './InteractiveVideoFeed'
import '../styles/Home.css'

function Home() {
  const [detectionData, setDetectionData] = useState({
    danger_zones: 0,
    max_risk: 0,
    frame_count: 0,
    processed_count: 0,
    zones: []
  })
  const [events, setEvents] = useState([])
  const [alertLevel, setAlertLevel] = useState('safe') // 'safe', 'warning', 'critical'
  const [drones, setDrones] = useState([]) // Lifted state for sharing between SimulatedView and DroneCam

  // Poll detection data from Python backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/detection_data')
        const data = await response.json()
        setDetectionData(data)

        // Determine alert level
        if (data.max_risk >= 0.8) {
          setAlertLevel('critical')
        } else if (data.max_risk >= 0.6) {
          setAlertLevel('warning')
        } else {
          setAlertLevel('safe')
        }

        // Add new event if danger zones detected
        if (data.zones && data.zones.length > 0) {
          const newEvents = data.zones.map(zone => ({
            id: `${zone.id}-${data.frame_count}`,
            level: zone.risk_score >= 0.8 ? 'critical' : 'warning',
            message: `Risk detected - ${(zone.risk_score * 100).toFixed(0)}%`,
            zone: `Zone #${zone.id}`,
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            metrics: zone.metrics
          }))
          setEvents(prev => [...newEvents, ...prev].slice(0, 20))
        }
      } catch (err) {
        console.error('Failed to fetch detection data:', err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 500) // Poll every 500ms
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard">
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid #1e293b',
        padding: '16px 32px',
        backgroundColor: '#0f172a',
        background: 'linear-gradient(to right, #0f172a, #1e293b)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <ShieldAlert size={28} color='#10b981' />
            <span style={{
              position: 'absolute',
              top: -2,
              right: -2,
              height: 10,
              width: 10,
              borderRadius: '50%',
              backgroundColor: alertLevel === 'critical' ? '#ef4444' : '#10b981',
              display: 'block',
              animation: alertLevel === 'critical' ? 'pulse 1s infinite' : 'none',
              boxShadow: `0 0 10px ${alertLevel === 'critical' ? '#ef4444' : '#10b981'}`
            }} />
          </div>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '1px' }}>
            ClearPath
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <Activity size={16} color='#10b981' />
            <span style={{ fontSize: 12, fontFamily: 'system-ui, sans-serif', color: '#10b981', fontWeight: 600 }}>
              AI ACTIVE
            </span>
          </div>
          <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 500 }}>
            {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </header>

      <div className="section-padding">
        {/* Critical Alert Banner */}
        {alertLevel === 'critical' && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.15)',
            border: '2px solid #ef4444',
            borderRadius: 12,
            padding: '20px 28px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            animation: 'pulse 2s infinite',
            boxShadow: '0 4px 20px rgba(239,68,68,0.3)'
          }}>
            <AlertTriangle size={36} color='#ef4444' />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', marginBottom: 6, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.5px' }}>
                ⚠️ CRITICAL ALERT — CROWD CRUSH RISK DETECTED
              </div>
              <div style={{ fontSize: 15, color: '#fca5a5', fontFamily: 'system-ui, sans-serif' }}>
                Drone dispatched to Zone #{detectionData.zones[0]?.id} • Risk Level: {(detectionData.max_risk * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {/* System Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <StatCard
            icon={Users}
            label="Frames Processed"
            value={detectionData.processed_count || 0}
            subtext="total frames analyzed"
          />
          <StatCard
            icon={AlertTriangle}
            label="Active Danger Zones"
            value={detectionData.danger_zones || 0}
            subtext="zones requiring attention"
            alert={detectionData.danger_zones > 0}
          />
          <StatCard
            icon={Gauge}
            label="Max Risk Level"
            value={`${(detectionData.max_risk * 100).toFixed(0)}%`}
            subtext="highest detected risk"
            alert={detectionData.max_risk >= 0.6}
          />
          <StatCard
            icon={Activity}
            label="Detection Count"
            value={detectionData.detection_count || 0}
            subtext="danger events detected"
          />
        </div>
        {/* Metrics Row */}
        <div style={{ marginBottom: 20 }}>
          {detectionData.zones && detectionData.zones.length > 0 && detectionData.zones[0] ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16
            }}>
              <MetricCard
                label="Bidirectional Flow"
                value={(detectionData.zones[0].metrics.bidirectional * 100).toFixed(0)}
                max={100}
                color="#f59e0b"
              />
              <MetricCard
                label="Crowd Density"
                value={(detectionData.zones[0].metrics.density * 100).toFixed(0)}
                max={100}
                color="#ef4444"
              />
              <MetricCard
                label="Flow Conflict"
                value={(detectionData.zones[0].metrics.flow_conflict * 100).toFixed(0)}
                max={100}
                color="#fb923c"
              />
              <MetricCard
                label="Stop-Go Waves"
                value={(detectionData.zones[0].metrics.stop_go * 100).toFixed(0)}
                max={100}
                color="#a78bfa"
              />
            </div>
          ) : (
            <div></div>
          )}
        </div>

        {/* Main Content: Full Width Live Feed on Top */}
        <div style={{ marginBottom: 20 }}>
          <InteractiveVideoFeed detectionData={detectionData} />
        </div>

        {/* Bottom Row: Tactical Map + Drone Cam */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Tactical Map */}
          <SimulatedView drones={drones} setDrones={setDrones} />

          {/* Drone Cam */}
          <DroneCam detectionData={detectionData} drones={drones} />
        </div>

        {/* Metrics Row */}
        {/* <div style={{ marginBottom: 20 }}>
          {detectionData.zones && detectionData.zones.length > 0 && detectionData.zones[0] ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16
            }}>
              <MetricCard
                label="Bidirectional Flow"
                value={(detectionData.zones[0].metrics.bidirectional * 100).toFixed(0)}
                max={100}
                color="#f59e0b"
              />
              <MetricCard
                label="Crowd Density"
                value={(detectionData.zones[0].metrics.density * 100).toFixed(0)}
                max={100}
                color="#ef4444"
              />
              <MetricCard
                label="Flow Conflict"
                value={(detectionData.zones[0].metrics.flow_conflict * 100).toFixed(0)}
                max={100}
                color="#fb923c"
              />
              <MetricCard
                label="Stop-Go Waves"
                value={(detectionData.zones[0].metrics.stop_go * 100).toFixed(0)}
                max={100}
                color="#a78bfa"
              />
            </div>
          ) : (
            <div></div>
          )}
        </div> */}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, subtext, alert }) {
  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: `2px solid ${alert ? '#ef4444' : '#1e293b'}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}>
      <div style={{
        height: 42,
        width: 42,
        borderRadius: 8,
        backgroundColor: alert ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
        border: `1px solid ${alert ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={20} color={alert ? '#ef4444' : '#10b981'} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontFamily: 'system-ui, sans-serif', fontWeight: 500 }}>
          {label}
        </div>
        <div style={{
          fontSize: 22,
          fontWeight: 700,
          color: alert ? '#ef4444' : '#e2e8f0',
          fontFamily: 'system-ui, sans-serif'
        }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
          {subtext}
        </div>
      </div>
    </div>
  )
}

function EventItem({ event }) {
  const iconColor = event.level === 'critical' ? '#ef4444' : '#f59e0b'
  const bgStyle = event.level === 'critical'
    ? { backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }
    : { backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }

  return (
    <div style={{
      ...bgStyle,
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 10,
      fontSize: 12,
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
        <AlertTriangle size={14} color={iconColor} style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f0f0f0', marginBottom: 2 }}>
            {event.message}
          </div>
          <div style={{ color: '#888', fontSize: 11 }}>
            {event.zone} • {event.time}
          </div>
          {event.metrics && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>
              Density: {(event.metrics.density * 100).toFixed(0)}% | Flow: {(event.metrics.bidirectional * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, max, color }) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '2px solid #1e293b',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 10
      }}>
        <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui, sans-serif', fontWeight: 500 }}>{label}</span>
        <span style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif'
        }}>
          {value}%
        </span>
      </div>
      <div style={{
        width: '100%',
        height: 8,
        backgroundColor: '#1e293b',
        borderRadius: 4,
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s ease',
          borderRadius: 4
        }} />
      </div>
    </div>
  )
}

export default Home

// ─── DASHBOARD HEADER ───────────────────────────────────────────────────────
/*
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

*/

/*
function Home() {
  return (
    <div className="dashboard">
      <DashboardHeader />

      <div className="section-padding">
        <SystemStats />
        <MetricsCharts />

        <div className="grid-2-1">
          <VideoFeed />
          <EventLog />
        </div>

        <VenueZones />
      </div>
    </div>
  )
}

export default Home
*/
// ─── SYSTEM STATS ────────────────────────────────────────────────────────────
/*
function SystemStats() {
  const [stats, setStats] = useState([
    { label: 'Total Detected', value: '547', subtext: 'persons across all zones', icon: Users },
    { label: 'Overload Score', value: '64', subtext: 'cognitive load index', icon: Brain },
    { label: 'System Latency', value: '12ms', subtext: 'on-device inference', icon: Gauge },
    { label: 'Active Interventions', value: '2', subtext: 'zones in intervention', icon: ShieldAlert },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => prev.map(s => {
        if (s.label === 'Total Detected') return { ...s, value: `${520 + Math.floor(Math.random() * 60)}` }
        if (s.label === 'Overload Score') return { ...s, value: `${50 + Math.floor(Math.random() * 35)}` }
        if (s.label === 'System Latency') return { ...s, value: `${8 + Math.floor(Math.random() * 10)}ms` }
        return s
      }))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {stats.map(({ label, value, subtext, icon: Icon }) => (
        <div key={label} style={{
          backgroundColor: '#0f0f1a', border: '1px solid #2a2a3a',
          borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            height: 36, width: 36, borderRadius: 6, backgroundColor: '#1e1e2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Icon size={18} color='#6ee7b7' />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>
              {label}
            </span>
            <span style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 600, color: '#f0f0f0', lineHeight: 1.2 }}>
              {value}
            </span>
            <span style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subtext}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

*/
// ─── METRICS CHARTS ──────────────────────────────────────────────────────────
/*
function ChartCard({ title, value, unit, data, dataKey, color }) {
  return (
    <div style={{
      backgroundColor: '#0f0f1a', border: '1px solid #2a2a3a',
      borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #2a2a3a'
      }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#f0f0f0' }}>
          {value}<span style={{ color: '#888', fontSize: 11 }}>{unit}</span>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 80, padding: 4 }}>
        <ResponsiveContainer width='100%' height={80}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stopColor={color} stopOpacity={0.3} />
                <stop offset='100%' stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey='time' hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={{
              backgroundColor: '#0f0f1a', border: '1px solid #2a2a3a',
              borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#f0f0f0'
            }} />
            <Area type='monotone' dataKey={dataKey} stroke={color} strokeWidth={1.5}
              fill={`url(#gradient-${dataKey})`} animationDuration={300} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MetricsCharts() {
  const [data, setData] = useState([])

  const generateData = useCallback(() => {
    const points = []
    const now = Date.now()
    for (let i = 20; i >= 0; i--) {
      const t = new Date(now - i * 5000)
      points.push({
        time: t.toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' }),
        density: 40 + Math.floor(Math.random() * 50),
        overload: 10 + Math.floor(Math.random() * 70),
        motion: 20 + Math.floor(Math.random() * 60),
      })
    }
    return points
  }, [])

  useEffect(() => {
    setData(generateData())
    const interval = setInterval(() => {
      setData(prev => {
        const t = new Date()
        const newPoint = {
          time: t.toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' }),
          density: 40 + Math.floor(Math.random() * 50),
          overload: 10 + Math.floor(Math.random() * 70),
          motion: 20 + Math.floor(Math.random() * 60),
        }
        return [...prev.slice(1), newPoint]
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [generateData])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, height: '100%' }}>
      <ChartCard title='CROWD DENSITY' value={data[data.length - 1]?.density ?? 0} unit='%'
        data={data} dataKey='density' color='#6ee7b7' />
      <ChartCard title='OVERLOAD INDEX' value={data[data.length - 1]?.overload ?? 0} unit='/100'
        data={data} dataKey='overload' color='#f87171' />
      <ChartCard title='MOTION IRREGULARITY' value={data[data.length - 1]?.motion ?? 0} unit='%'
        data={data} dataKey='motion' color='#fbbf24' />
    </div>
  )
}
*/
// ─── VIDEO FEED ───────────────────────────────────────────────────────────────
/*
function VideoFeed() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const [overloadState, setOverloadState] = useState({ level: 'normal', label: 'NORMAL', color: '#6ee7b7' })
  const [crowdCount, setCrowdCount] = useState(142)
  const [fps, setFps] = useState(30)

  const cycleThroughStates = useCallback(() => {
    const states = [
      { level: 'normal', label: 'NORMAL', color: '#6ee7b7' },
      { level: 'normal', label: 'NORMAL', color: '#6ee7b7' },
      { level: 'elevated', label: 'ELEVATED', color: '#fbbf24' },
      { level: 'elevated', label: 'ELEVATED', color: '#fbbf24' },
      { level: 'critical', label: 'CRITICAL', color: '#f87171' },
      { level: 'normal', label: 'NORMAL', color: '#6ee7b7' },
    ]
    const idx = Math.floor(Date.now() / 8000) % states.length
    setOverloadState(states[idx])
    setCrowdCount(120 + Math.floor(Math.random() * 80))
    setFps(28 + Math.floor(Math.random() * 4))
  }, [])

  useEffect(() => {
    const interval = setInterval(cycleThroughStates, 3000)
    return () => clearInterval(interval)
  }, [cycleThroughStates])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dots = []
    for (let i = 0; i < 60; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        size: 2 + Math.random() * 3,
      })
    }

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      ctx.fillStyle = 'rgba(14, 17, 23, 0.15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const isElevated = overloadState.level === 'elevated'
      const isCritical = overloadState.level === 'critical'

      dots.forEach(dot => {
        dot.x += dot.vx + (isCritical ? (Math.random() - 0.5) * 2 : 0)
        dot.y += dot.vy + (isCritical ? (Math.random() - 0.5) * 2 : 0)
        if (dot.x < 0 || dot.x > canvas.width) dot.vx *= -1
        if (dot.y < 0 || dot.y > canvas.height) dot.vy *= -1

        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2)
        ctx.fillStyle = isCritical ? 'rgba(239,68,68,0.8)' : isElevated ? 'rgba(234,179,8,0.7)' : 'rgba(52,211,153,0.6)'
        ctx.fill()
      })

      ctx.strokeStyle = 'rgba(52,211,153,0.05)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
      }

      const time = Date.now() / 1000
      for (let i = 0; i < 3; i++) {
        const bx = 80 + i * 180 + Math.sin(time + i) * 20
        const by = 60 + i * 80 + Math.cos(time + i * 0.5) * 15
        const bw = 60 + Math.sin(time * 0.5 + i) * 10
        const bh = 50 + Math.cos(time * 0.3 + i) * 10
        const boxColor = isCritical ? 'rgba(239,68,68,0.6)' : isElevated ? 'rgba(234,179,8,0.4)' : 'rgba(52,211,153,0.3)'
        const cornerColor = isCritical ? 'rgba(239,68,68,0.9)' : isElevated ? 'rgba(234,179,8,0.7)' : 'rgba(52,211,153,0.5)'
        const cl = 8
        ctx.strokeStyle = boxColor; ctx.lineWidth = 1
        ctx.strokeRect(bx, by, bw, bh)
        ctx.strokeStyle = cornerColor; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(bx, by + cl); ctx.lineTo(bx, by); ctx.lineTo(bx + cl, by); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bx + bw - cl, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cl); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bx, by + bh - cl); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cl, by + bh); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bx + bw - cl, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cl); ctx.stroke()
      }
    }
    animate()
    return () => cancelAnimationFrame(frameRef.current)
  }, [overloadState])

  const StatusIcon = overloadState.level === 'critical' ? AlertTriangle : ShieldCheck

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      backgroundColor: '#0f0f1a', borderRadius: 8, border: '1px solid #2a2a3a', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid #2a2a3a', backgroundColor: '#0a0a14'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={14} color='#888' />
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>
            Live Feed - Main Entrance
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888' }}>{fps} FPS</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ height: 8, width: 8, borderRadius: '50%', backgroundColor: '#f87171', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#f87171' }}>REC</span>
          </span>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={720} height={300} style={{ width: '100%', display: 'block' }} />

        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(0,0,0,0.75)', padding: '4px 8px', borderRadius: 4
          }}>
            <StatusIcon size={14} color={overloadState.color} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: overloadState.color }}>
              OVERLOAD: {overloadState.label}
            </span>
          </div>
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.75)', padding: '4px 8px',
            borderRadius: 4, fontSize: 11, fontFamily: 'monospace', color: '#888'
          }}>
            DETECTED: {crowdCount} persons
          </div>
        </div>

        {overloadState.level === 'critical' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: 'rgba(239,68,68,0.9)', padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <AlertTriangle size={20} color='white' />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
                INTERVENTION MODE ACTIVE
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                Stop moving. Wait 20 seconds.
              </span>
            </div>
          </div>
        )}

        {overloadState.level === 'elevated' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: 'rgba(234,179,8,0.9)', padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <AlertTriangle size={20} color='white' />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
                ELEVATED STRESS DETECTED
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                Follow the green exit on your left.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
*/
// ─── EVENT LOG ────────────────────────────────────────────────────────────────
/*
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

*/

// ─── VENUE ZONES ─────────────────────────────────────────────────────────────
/*
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

*/

// ─── HOME (MAIN DASHBOARD) ───────────────────────────────────────────────────

/*
function Home() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080810', color: '#f0f0f0' }}>
      <DashboardHeader />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SystemStats />
        <MetricsCharts />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, minHeight: 500 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <VideoFeed />
          </div>
          <EventLog />
        </div>
        <VenueZones />
      </div>
    </div>
  )
}
*/



