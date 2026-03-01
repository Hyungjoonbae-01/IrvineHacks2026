import React, { useEffect, useRef, useState } from 'react'
import { Radar, Navigation } from 'lucide-react'

function SimulatedView({ drones, setDrones }) {
  const canvasRef = useRef(null)
  const [detectionData, setDetectionData] = useState({ zones: [] })
  const [hoveredZone, setHoveredZone] = useState(null)
  const animationFrameRef = useRef(null)
  const pulseRef = useRef(0)

  // Map dimensions (16:9 aspect ratio)
  const MAP_WIDTH = 800
  const MAP_HEIGHT = 450
  const VIDEO_WIDTH = 1920
  const VIDEO_HEIGHT = 1080

  // Convert video coordinates to map coordinates
  const videoToMap = (x, y) => ({
    x: (x / VIDEO_WIDTH) * MAP_WIDTH,
    y: (y / VIDEO_HEIGHT) * MAP_HEIGHT
  })

  // Poll detection data from Flask API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/detection_data')
        if (response.ok) {
          const data = await response.json()
          setDetectionData(data)
          
          // Create/update drones for each zone
          if (data.zones && data.zones.length > 0) {
            setDrones(prevDrones => {
              const newDrones = data.zones.map((zone, index) => {
                const target = videoToMap(zone.center[0], zone.center[1])
                const existingDrone = prevDrones.find(d => d.zoneId === zone.id)
                
                if (existingDrone) {
                  return { ...existingDrone, target, zoneId: zone.id }
                } else {
                  // Spawn new drone at a random edge position
                  const spawnSide = Math.floor(Math.random() * 4)
                  let spawnX, spawnY
                  switch (spawnSide) {
                    case 0: spawnX = Math.random() * MAP_WIDTH; spawnY = 0; break // Top
                    case 1: spawnX = MAP_WIDTH; spawnY = Math.random() * MAP_HEIGHT; break // Right
                    case 2: spawnX = Math.random() * MAP_WIDTH; spawnY = MAP_HEIGHT; break // Bottom
                    default: spawnX = 0; spawnY = Math.random() * MAP_HEIGHT; break // Left
                  }
                  return {
                    zoneId: zone.id,
                    x: spawnX,
                    y: spawnY,
                    target,
                    arrived: false
                  }
                }
              })
              return newDrones
            })
          } else {
            setDrones([])
          }
        }
      } catch (err) {
        console.error('Failed to fetch detection data:', err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 500)
    return () => clearInterval(interval)
  }, [])

  // Animate all drones
  useEffect(() => {
    if (drones.length === 0) return

    const animate = () => {
      setDrones(prevDrones => prevDrones.map(drone => {
        const dx = drone.target.x - drone.x
        const dy = drone.target.y - drone.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Mark as arrived when within 10 pixels
        if (distance < 10) {
          return { ...drone, x: drone.target.x, y: drone.target.y, arrived: true }
        }

        // Smooth easing
        const speed = 0.04
        return {
          ...drone,
          x: drone.x + dx * speed,
          y: drone.y + dy * speed,
          arrived: false
        }
      }))

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drones.length])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    pulseRef.current += 0.05

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#0a0a15'
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

      // Draw grid
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = 1
      for (let i = 0; i <= MAP_WIDTH; i += 40) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, MAP_HEIGHT)
        ctx.stroke()
      }
      for (let i = 0; i <= MAP_HEIGHT; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(MAP_WIDTH, i)
        ctx.stroke()
      }

      // Draw venue outline
      ctx.strokeStyle = '#6ee7b7'
      ctx.lineWidth = 3
      ctx.setLineDash([10, 5])
      ctx.strokeRect(20, 20, MAP_WIDTH - 40, MAP_HEIGHT - 40)
      ctx.setLineDash([])

      // Draw danger zones with dual circles
      detectionData.zones?.forEach((zone, index) => {
        const mapPos = videoToMap(zone.center[0], zone.center[1])
        const mapRadius = (zone.radius / VIDEO_WIDTH) * MAP_WIDTH

        // Pulsing effect
        const pulse = Math.sin(pulseRef.current + index * 0.5) * 0.3 + 0.7

        // Check if drone has arrived at this zone
        const droneForZone = drones.find(d => d.zoneId === zone.id)
        const droneArrived = droneForZone && droneForZone.arrived

        if (!droneArrived) {
          // BEFORE DRONE ARRIVAL: Show grey dotted circle
          const detectionRadius = mapRadius * 1.5
          
          ctx.strokeStyle = `rgba(156, 163, 175, ${0.6 * pulse})`
          ctx.lineWidth = 2
          ctx.setLineDash([8, 4])
          ctx.beginPath()
          ctx.arc(mapPos.x, mapPos.y, detectionRadius, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])

          // Detection label
          ctx.fillStyle = '#9ca3af'
          ctx.font = '10px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('DETECTED - DISPATCHING', mapPos.x, mapPos.y - detectionRadius - 8)

          // Zone label (muted)
          ctx.fillStyle = '#9ca3af'
          ctx.font = 'bold 12px monospace'
          ctx.fillText(`ZONE #${zone.id}`, mapPos.x, mapPos.y - 5)
          ctx.font = '14px monospace'
          ctx.fillText(`${Math.round(zone.risk_score * 100)}%`, mapPos.x, mapPos.y + 10)
        } else {
          // AFTER DRONE ARRIVAL: Show red inner + green outer circles
          
          // OUTER GUIDANCE CIRCLE (green, safe zone - half the original size)
          const outerRadius = mapRadius * 1.25
          
          // Outer glow
          const outerGradient = ctx.createRadialGradient(mapPos.x, mapPos.y, 0, mapPos.x, mapPos.y, outerRadius * 1.2)
          outerGradient.addColorStop(0, 'rgba(16, 185, 129, 0)')
          outerGradient.addColorStop(0.5, `rgba(16, 185, 129, ${0.15 * pulse})`)
          outerGradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
          ctx.fillStyle = outerGradient
          ctx.fillRect(
            mapPos.x - outerRadius * 1.2, 
            mapPos.y - outerRadius * 1.2, 
            outerRadius * 2.4, 
            outerRadius * 2.4
          )

          // Outer circle border
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.6 * pulse})`
          ctx.lineWidth = 2
          ctx.setLineDash([10, 5])
          ctx.beginPath()
          ctx.arc(mapPos.x, mapPos.y, outerRadius, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])

          // Outer circle label
          ctx.fillStyle = '#10b981'
          ctx.font = '10px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('SAFE ZONE', mapPos.x, mapPos.y - outerRadius - 8)

          // INNER DANGER CIRCLE (smaller, actual risk zone)
          const innerRadius = mapRadius * 0.6
          // Inner glow
          const innerGradient = ctx.createRadialGradient(mapPos.x, mapPos.y, 0, mapPos.x, mapPos.y, innerRadius * 1.5)
          innerGradient.addColorStop(0, `rgba(239, 68, 68, ${0.5 * pulse})`)
          innerGradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
          ctx.fillStyle = innerGradient
          ctx.fillRect(
            mapPos.x - innerRadius * 1.5, 
            mapPos.y - innerRadius * 1.5, 
            innerRadius * 3, 
            innerRadius * 3
          )

          // Inner circle
          ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(mapPos.x, mapPos.y, innerRadius, 0, Math.PI * 2)
          ctx.stroke()

          // Fill
          ctx.fillStyle = `rgba(220, 38, 38, ${0.4 * pulse})`
          ctx.fill()

          // Zone label
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 12px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`ZONE #${zone.id}`, mapPos.x, mapPos.y - 5)
          ctx.font = '14px monospace'
          ctx.fillText(`${Math.round(zone.risk_score * 100)}%`, mapPos.x, mapPos.y + 10)
        }

        // Hover tooltip
        if (hoveredZone === zone.id) {
          const tooltipRadius = droneArrived ? mapRadius * 1.25 : mapRadius * 1.5
          const tooltipX = mapPos.x + tooltipRadius + 20
          const tooltipY = mapPos.y - 40
          
          ctx.fillStyle = 'rgba(15, 15, 26, 0.95)'
          ctx.fillRect(tooltipX, tooltipY, 180, 80)
          ctx.strokeStyle = '#6ee7b7'
          ctx.lineWidth = 1
          ctx.strokeRect(tooltipX, tooltipY, 180, 80)

          ctx.fillStyle = '#ffffff'
          ctx.font = '11px monospace'
          ctx.textAlign = 'left'
          ctx.fillText(`Zone ID: ${zone.id}`, tooltipX + 10, tooltipY + 20)
          ctx.fillText(`Risk: ${Math.round(zone.risk_score * 100)}%`, tooltipX + 10, tooltipY + 35)
          ctx.fillText(`Duration: ${zone.duration}s`, tooltipX + 10, tooltipY + 50)
          ctx.fillText(`People: ${zone.person_count}`, tooltipX + 10, tooltipY + 65)
        }
      })

      // Draw flight paths for all drones (only if not arrived)
      drones.forEach(drone => {
        if (!drone.arrived) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'
          ctx.lineWidth = 1
          ctx.setLineDash([5, 3])
          ctx.beginPath()
          ctx.moveTo(drone.x, drone.y)
          ctx.lineTo(drone.target.x, drone.target.y)
          ctx.stroke()
          ctx.setLineDash([])
        }
      })

      // Draw all drones
      drones.forEach((drone, index) => {
        const droneSize = 16
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2
        
        ctx.save()
        ctx.translate(drone.x, drone.y)
        
        // Calculate rotation towards target (only if not arrived)
        if (!drone.arrived) {
          const angle = Math.atan2(
            drone.target.y - drone.y,
            drone.target.x - drone.x
          )
          ctx.rotate(angle + Math.PI / 2)
        }

        ctx.beginPath()
        ctx.moveTo(0, -droneSize)
        ctx.lineTo(droneSize * 0.7, droneSize * 0.5)
        ctx.lineTo(0, droneSize * 0.2)
        ctx.lineTo(-droneSize * 0.7, droneSize * 0.5)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        
        ctx.restore()

        // Drone label
        ctx.fillStyle = '#10b981'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`D${index + 1}`, drone.x, drone.y + droneSize + 12)

        // ETA or status
        if (drone.arrived) {
          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 8px monospace'
          ctx.fillText('ON-SITE', drone.x, drone.y + droneSize + 22)
        } else {
          const distance = Math.sqrt(
            Math.pow(drone.target.x - drone.x, 2) +
            Math.pow(drone.target.y - drone.y, 2)
          )
          const eta = Math.max(0, Math.round(distance / 4))
          
          if (eta > 0) {
            ctx.fillStyle = '#fbbf24'
            ctx.font = '8px monospace'
            ctx.fillText(`ETA ${eta}s`, drone.x, drone.y + droneSize + 22)
          }
        }
      })

      // Status label
      ctx.fillStyle = 'rgba(15, 15, 26, 0.9)'
      ctx.fillRect(10, MAP_HEIGHT - 35, 220, 25)
      ctx.strokeStyle = '#6ee7b7'
      ctx.lineWidth = 1
      ctx.strokeRect(10, MAP_HEIGHT - 35, 220, 25)
      
      const arrivedCount = drones.filter(d => d.arrived).length
      const enRouteCount = drones.length - arrivedCount
      
      ctx.fillStyle = detectionData.zones?.length > 0 ? '#ef4444' : '#10b981'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'left'
      
      let statusText
      if (detectionData.zones?.length > 0) {
        if (arrivedCount > 0 && enRouteCount > 0) {
          statusText = `⚠ ${arrivedCount} ON-SITE | ${enRouteCount} EN ROUTE`
        } else if (arrivedCount > 0) {
          statusText = `✓ ${arrivedCount} DRONE${arrivedCount !== 1 ? 'S' : ''} ON-SITE`
          ctx.fillStyle = '#10b981'
        } else {
          statusText = `⚠ ${drones.length} DRONE${drones.length !== 1 ? 'S' : ''} DISPATCHED`
        }
      } else {
        statusText = '✓ MONITORING'
      }
      
      ctx.fillText(statusText, 20, MAP_HEIGHT - 18)

      requestAnimationFrame(render)
    }

    render()
  }, [detectionData, drones, hoveredZone])

  // Mouse hover detection
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    let foundZone = null
    detectionData.zones?.forEach(zone => {
      const mapPos = videoToMap(zone.center[0], zone.center[1])
      const mapRadius = (zone.radius / VIDEO_WIDTH) * MAP_WIDTH
      
      // Check if drone has arrived
      const droneForZone = drones.find(d => d.zoneId === zone.id)
      const droneArrived = droneForZone && droneForZone.arrived
      
      // Use different radius based on drone arrival
      const hoverRadius = droneArrived ? mapRadius * 1.25 : mapRadius * 1.5
      
      const distance = Math.sqrt(
        Math.pow(mouseX - mapPos.x, 2) + Math.pow(mouseY - mapPos.y, 2)
      )
      if (distance <= hoverRadius) {
        foundZone = zone.id
      }
    })

    setHoveredZone(foundZone)
  }

  return (
    <div style={{
      backgroundColor: '#0a0a14',
      borderRadius: 12,
      border: '2px solid #1e293b',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 20px',
        borderBottom: '2px solid #1e293b',
        backgroundColor: '#0f172a',
        background: 'linear-gradient(to right, #0f172a, #1e293b)'
      }}>
        <Radar size={16} color='#10b981' />
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#e2e8f0', letterSpacing: '0.5px' }}>
          TACTICAL MAP — REAL-TIME POSITIONING
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', padding: '4px 10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: 4, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <Navigation size={12} color='#10b981' />
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
            ACTIVE
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredZone(null)}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          cursor: hoveredZone ? 'pointer' : 'default'
        }}
      />
    </div>
  )
}

export default SimulatedView