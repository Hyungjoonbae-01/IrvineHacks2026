import React, { useState } from 'react'
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react'

function DroneCam({ detectionData, drones }) {
  const [activeDroneIndex, setActiveDroneIndex] = useState(0)
  
  const zones = detectionData.zones || []
  const activeZone = zones[activeDroneIndex]
  
  // Get drone for this zone
  const droneForZone = drones.find(d => d.zoneId === activeZone?.id)
  const droneArrived = droneForZone && droneForZone.arrived

  const nextDrone = () => {
    setActiveDroneIndex((prev) => (prev + 1) % zones.length)
  }

  const prevDrone = () => {
    setActiveDroneIndex((prev) => (prev - 1 + zones.length) % zones.length)
  }

  return (
    <div style={{
      backgroundColor: '#0a0a14',
      border: '2px solid #1e293b',
      borderRadius: 12,
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
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
          <Camera size={16} color='#f59e0b' />
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#e2e8f0', letterSpacing: '0.5px' }}>
            {zones.length > 0 ? `DRONE ${activeDroneIndex + 1} POV — ZONE #${activeZone?.id}` : 'NO ACTIVE DRONES'}
          </span>
        </div>

        {/* Drone Switcher Buttons */}
        {zones.length > 1 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={prevDrone}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                border: '1px solid #2a2a3a',
                borderRadius: 4,
                backgroundColor: '#1a1a2e',
                color: '#6ee7b7',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#252538'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#1a1a2e'}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={nextDrone}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                border: '1px solid #2a2a3a',
                borderRadius: 4,
                backgroundColor: '#1a1a2e',
                color: '#6ee7b7',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#252538'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#1a1a2e'}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Live Video Feed - No Overlay */}
      <div style={{
        width: '100%',
        height: 450,
        backgroundColor: '#000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {zones.length > 0 ? (
          <img
            src="http://localhost:5000/raw_video_feed"
            alt="Drone camera view"
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              objectPosition: `${activeDroneIndex === 0 ? '25%' : activeDroneIndex === 1 ? '75%' : '50%'} ${activeDroneIndex === 0 ? '30%' : activeDroneIndex === 1 ? '30%' : '50%'}`,
              display: 'block'
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 240
          }}>
            <Camera size={32} color='#333' />
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#333', textTransform: 'uppercase' }}>
              No drones deployed
            </span>
          </div>
        )}
      </div>

      {/* Zone Info Footer */}
      {activeZone && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#0a0a14',
          borderTop: '1px solid #2a2a3a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'monospace' }}>
            <span style={{ color: '#888' }}>
              Status: <span style={{ color: droneArrived ? '#10b981' : '#fbbf24', fontWeight: 'bold' }}>
                {droneArrived ? 'ON-SITE' : 'EN ROUTE'}
              </span>
            </span>
            <span style={{ color: '#888' }}>
              Risk: <span style={{ color: activeZone.risk_score >= 0.8 ? '#f87171' : '#fbbf24', fontWeight: 'bold' }}>
                {Math.round(activeZone.risk_score * 100)}%
              </span>
            </span>
          </div>
          {zones.length > 1 && (
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#666' }}>
              {activeDroneIndex + 1} / {zones.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DroneCam
