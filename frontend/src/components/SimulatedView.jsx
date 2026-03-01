import React, { useState } from 'react'
import { Camera } from 'lucide-react'

function SimulatedView() {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div style={{
      backgroundColor: '#0f0f1a', borderRadius: 8,
      border: '1px solid #2a2a3a', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderBottom: '1px solid #2a2a3a', backgroundColor: '#0a0a14'
      }}>
        <Camera size={14} color='#888' />
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#888', textTransform: 'uppercase' }}>
          Drone Feed - Crush Risk Detection
        </span>
      </div>

      {/* Video stream */}
      {!error && (
        <img
          src="http://127.0.0.1:5000/video_feed"
          alt="Drone feed"
          style={{ width: '100%', display: loaded ? 'block' : 'none' }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}

      {/* Placeholder — only shows if stream hasn't loaded or errored */}
      {(!loaded || error) && (
        <div style={{
          width: '100%', height: 300, backgroundColor: '#000',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <Camera size={32} color='#333' />
          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#333', textTransform: 'uppercase' }}>
            {error ? 'Stream offline' : 'Connecting to drone feed...'}
          </span>
        </div>
      )}
    </div>
  )
}

export default SimulatedView