import React, { useState, useEffect, useCallback } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

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

export default MetricsCharts