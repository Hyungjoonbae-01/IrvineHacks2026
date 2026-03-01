import React, { useRef, useEffect, useState } from 'react'
import { Camera, AlertTriangle, ShieldCheck } from 'lucide-react'

function InteractiveVideoFeed({ detectionData }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [hoveredZone, setHoveredZone] = useState(null)
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })

  // Draw overlays on the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !detectionData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawOverlays = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const zones = detectionData.zones || []
      const safeZone = detectionData.safe_zone

      // Draw safe zone (green circle)
      if (safeZone && safeZone.center) {
        const [sx, sy] = safeZone.center
        const sr = safeZone.radius || 50

        // Green circle outline
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.stroke()

        // Green fill
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)'
        ctx.fill()

        // "SAFE" label
        ctx.fillStyle = 'rgba(16, 185, 129, 0.9)'
        ctx.fillRect(sx - 30, sy - sr - 25, 60, 20)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('SAFE', sx, sy - sr - 12)
      }

      // Draw danger zones (red circles)
      zones.forEach((zone, idx) => {
        const [cx, cy] = zone.center || [0, 0]
        const radius = zone.radius || 40
        const isHovered = hoveredZone === idx

        // Draw circle
        ctx.strokeStyle = isHovered ? 'rgba(248, 113, 113, 1)' : 'rgba(248, 113, 113, 0.8)'
        ctx.lineWidth = isHovered ? 4 : 3
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.stroke()

        // Fill
        ctx.fillStyle = isHovered ? 'rgba(248, 113, 113, 0.25)' : 'rgba(248, 113, 113, 0.15)'
        ctx.fill()

        // Zone header
        const headerWidth = 120
        const headerHeight = 24
        ctx.fillStyle = isHovered ? 'rgba(248, 113, 113, 1)' : 'rgba(248, 113, 113, 0.9)'
        ctx.fillRect(cx - headerWidth / 2, cy - radius - 35, headerWidth, headerHeight)

        // Zone label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`DANGER ZONE #${zone.id || idx + 1}`, cx, cy - radius - 18)

        // Risk percentage
        ctx.font = 'bold 14px monospace'
        ctx.fillStyle = '#fff'
        ctx.fillText(`${Math.round((zone.risk_score || 0) * 100)}%`, cx, cy)

        // Show metrics on hover
        if (isHovered && zone.metrics) {
          const metrics = zone.metrics
          const infoBox = {
            x: cx + radius + 15,
            y: cy - 60,
            width: 180,
            height: 100
          }

          // Info box background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
          ctx.fillRect(infoBox.x, infoBox.y, infoBox.width, infoBox.height)
          ctx.strokeStyle = 'rgba(248, 113, 113, 1)'
          ctx.lineWidth = 2
          ctx.strokeRect(infoBox.x, infoBox.y, infoBox.width, infoBox.height)

          // Metrics text
          ctx.font = '10px monospace'
          ctx.textAlign = 'left'
          ctx.fillStyle = '#fff'
          let yOffset = infoBox.y + 18
          const lineHeight = 16

          ctx.fillText(`Density: ${(metrics.density || 0).toFixed(2)}`, infoBox.x + 10, yOffset)
          yOffset += lineHeight
          ctx.fillText(`Flow: ${(metrics.bidirectional || 0).toFixed(2)}`, infoBox.x + 10, yOffset)
          yOffset += lineHeight
          ctx.fillText(`Conflict: ${(metrics.flow_conflict || 0).toFixed(2)}`, infoBox.x + 10, yOffset)
          yOffset += lineHeight
          ctx.fillText(`Waves: ${(metrics.stop_go || 0).toFixed(2)}`, infoBox.x + 10, yOffset)
          yOffset += lineHeight
          ctx.fillText(`Active: ${(zone.active_duration || 0).toFixed(1)}s`, infoBox.x + 10, yOffset)
        }

        // Draw arrow from safe zone to danger zone
        if (safeZone && safeZone.center) {
          const [sx, sy] = safeZone.center
          const sr = safeZone.radius || 50

          // Calculate arrow start and end points
          const angle = Math.atan2(cy - sy, cx - sx)
          const startX = sx + Math.cos(angle) * sr
          const startY = sy + Math.sin(angle) * sr
          const endX = cx - Math.cos(angle) * radius
          const endY = cy - Math.sin(angle) * radius

          // Draw arrow
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
          ctx.setLineDash([])

          // Arrow head
          const headlen = 12
          const headAngle = Math.PI / 6
          ctx.fillStyle = 'rgba(251, 191, 36, 0.8)'
          ctx.beginPath()
          ctx.moveTo(endX, endY)
          ctx.lineTo(
            endX - headlen * Math.cos(angle - headAngle),
            endY - headlen * Math.sin(angle - headAngle)
          )
          ctx.lineTo(
            endX - headlen * Math.cos(angle + headAngle),
            endY - headlen * Math.sin(angle + headAngle)
          )
          ctx.closePath()
          ctx.fill()
        }
      })

      requestAnimationFrame(drawOverlays)
    }

    drawOverlays()
  }, [detectionData, hoveredZone])

  // Handle video load to set canvas size
  const handleVideoLoad = (e) => {
    const img = e.target
    const canvas = canvasRef.current
    if (img && canvas) {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      setVideoSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
  }

  // Handle mouse move to detect hover
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas || !detectionData) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const zones = detectionData.zones || []
    let foundZone = null

    zones.forEach((zone, idx) => {
      const [cx, cy] = zone.center || [0, 0]
      const radius = zone.radius || 40
      const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)

      if (distance <= radius) {
        foundZone = idx
      }
    })

    setHoveredZone(foundZone)
  }

  const zones = detectionData?.zones || []
  const overloadLevel = zones.length === 0 ? 'normal' : zones.length === 1 ? 'elevated' : 'critical'
  const overloadLabel = overloadLevel === 'critical' ? 'CRITICAL' : overloadLevel === 'elevated' ? 'ELEVATED' : 'NORMAL'
  const overloadColor = overloadLevel === 'critical' ? '#f87171' : overloadLevel === 'elevated' ? '#fbbf24' : '#6ee7b7'
  const StatusIcon = overloadLevel === 'critical' ? AlertTriangle : ShieldCheck

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a0a14',
      borderRadius: 12,
      border: '2px solid #1e293b',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '2px solid #1e293b',
        backgroundColor: '#0f172a',
        background: 'linear-gradient(to right, #0f172a, #1e293b)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }} />
          <Camera size={16} color='#10b981' />
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#e2e8f0', letterSpacing: '0.5px' }}>
            LIVE FEED — MAIN ENTRANCE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 500 }}>30 FPS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 4, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={{ height: 6, width: 6, borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#ef4444', fontWeight: 600 }}>RECORDING</span>
          </div>
        </div>
      </div>

      {/* Video + Canvas Container */}
      <div style={{ position: 'relative' }}>
        {/* Raw video feed (no overlays) */}
        <img
          ref={videoRef}
          src="http://localhost:5000/raw_video_feed"
          alt="Raw video feed"
          onLoad={handleVideoLoad}
          style={{ width: '100%', height: '100%', display: 'block'}}
        />

        {/* Canvas overlay (interactive) */}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredZone(null)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: hoveredZone !== null ? 'pointer' : 'default'
          }}
        />

        {/* Status overlay */}
        <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${overloadColor}40`,
            backdropFilter: 'blur(10px)'
          }}>
            <StatusIcon size={16} color={overloadColor} />
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'system-ui, sans-serif', color: overloadColor }}>
              {overloadLabel}
            </span>
          </div>
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'system-ui, sans-serif',
            color: '#cbd5e1',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            backdropFilter: 'blur(10px)'
          }}>
            <span style={{ fontWeight: 600, color: '#10b981' }}>{zones.length}</span> Active Zone{zones.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Alert banners */}
        {overloadLevel === 'critical' && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(239,68,68,0.9)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <AlertTriangle size={20} color='white' />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
                INTERVENTION MODE ACTIVE
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                Multiple danger zones detected. Drones deployed.
              </span>
            </div>
          </div>
        )}

        {overloadLevel === 'elevated' && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(234,179,8,0.9)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <AlertTriangle size={20} color='white' />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
                ELEVATED STRESS DETECTED
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                Follow the green safe zone. Hover for details.
              </span>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

export default InteractiveVideoFeed