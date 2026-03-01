import React from 'react'
import { Camera } from 'lucide-react'

function SimulatedView() {
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

      {/* ── STREAM INPUT ────────────────────────────────────────────────────
          Replace the src below with your Flask stream URL.
          Your Python backend must be running and serving frames at this URL.
          Default assumes backend runs on port 5000.
      ─────────────────────────────────────────────────────────────────── */}
      <img
        src="http://127.0.0.1:5000/video_feed"
        alt="Drone feed"
        style={{ width: '100%', display: 'block' }}
        onError={(e) => { e.target.style.display = 'none' }}
      />

      {/* ── PLACEHOLDER ─────────────────────────────────────────────────────
          This shows when the stream is offline / backend not running.
          Remove or hide this once your backend is live.
      ─────────────────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', height: 300, backgroundColor: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8
      }}>
        <Camera size={32} color='#333' />
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#333', textTransform: 'uppercase' }}>
          Awaiting drone feed...
        </span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#222' }}>
          Start Python backend to stream
        </span>
      </div>
    </div>
  )
}

export default SimulatedView