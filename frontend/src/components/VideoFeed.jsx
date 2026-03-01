
import React, { useState, useEffect, useRef, useCallback } from 'react'

// Lucide icons (or whichever icon library you’re using)
import { AlertTriangle, ShieldCheck, Camera, ArrowRight, Info } from 'lucide-react'


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

export default VideoFeed