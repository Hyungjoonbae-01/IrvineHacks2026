"""
Crowd Crush Risk Detection Demo

Dynamically detects dangerous crowd conditions that could lead to crushing incidents.
Inspired by Itaewon crowd crush analysis.

Key Features:
- Scans entire frame (no fixed zones)
- Detects high density + opposing flows
- Shows RED danger circle and GREEN safe zone
- Real-time processing at 1x speed
- Smooth detection (no "popping")

Usage:
    # Fast mode (default - optimized for performance)
    python demo_crush_risk.py --video ../data/videos/video_2.mp4
    
    # Webcam mode
    python demo_crush_risk.py --webcam
    
    # Brio 100 or external camera
    python demo_crush_risk.py --webcam --camera-index 1
    
    # Full resolution with YOLO optimization (recommended with CUDA)
    python demo_crush_risk.py --video ../data/videos/video_2.mp4 --scale 1.0 --yolo-interval 2
    
    # High quality mode (slower)
    python demo_crush_risk.py --video video_2.mp4 --scale 1.0 --skip-frames 0 --grid-size 64
    
    # Very fast mode (real-time on slower machines)
    python demo_crush_risk.py --video video_2.mp4 --scale 0.3 --skip-frames 4 --grid-size 128

Controls:
    q - Quit
    p - Pause/Resume
    r - Reset detector
    s - Save current frame
"""

import cv2
import numpy as np
import sys
import os
import argparse
import threading
from datetime import datetime
from flask import Flask, Response
from flask_cors import CORS


# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ai.perception.crush_detector import CrushRiskDetector, draw_crush_risk_circles


##ADDED FROM 
# ── FLASK SETUP ──────────────────────────────────────────────────────────────
# This shared variable holds the latest processed frame so Flask can serve it.
# The lock prevents the video loop and Flask from reading/writing at the same time.
app = Flask(__name__)
CORS(app)
latest_frame = None        # holds the most recent output_frame as JPEG bytes (with overlays)
latest_raw_frame = None    # holds the raw frame WITHOUT overlays (for interactive frontend)
latest_detection_data = {}  # holds the current detection metrics
frame_lock = threading.Lock()
raw_frame_lock = threading.Lock()
data_lock = threading.Lock()
# ─────────────────────────────────────────────────────────────────────────────


def generate_frames():
    """Yields frames in MJPEG format for the browser to display."""
    while True:
        with frame_lock:
            if latest_frame is None:
                continue
            frame_bytes = latest_frame
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


@app.route('/video_feed')
def video_feed():
    """Flask route for video WITH overlays (circles, arrows, text)."""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


def generate_raw_frames():
    """Yields raw frames (no overlays) in MJPEG format for interactive frontend."""
    while True:
        with raw_frame_lock:
            if latest_raw_frame is None:
                continue
            frame_bytes = latest_raw_frame
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


@app.route('/raw_video_feed')
def raw_video_feed():
    """Flask route for RAW video WITHOUT overlays - for interactive frontend."""
    return Response(generate_raw_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/')
def index():
    return '<h3>Streams: <a href="/video_feed">With Overlays</a> | <a href="/raw_video_feed">Raw (Interactive)</a> | <a href="/api/detection_data">Detection Data</a></h3>'


@app.route('/api/detection_data')
def get_detection_data():
    """Return current detection metrics as JSON for the dashboard."""
    with data_lock:
        return latest_detection_data

def main():
    parser = argparse.ArgumentParser(
        description='Crowd Crush Risk Detection Demo',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--video', type=str, default=None,
                       help='Path to video file (default: webcam)')
    parser.add_argument('--webcam', action='store_true',
                       help='Use webcam instead of video file')
    parser.add_argument('--camera-index', type=int, default=0,
                       help='Camera device index (0=default, 1=Brio 100, etc.)')
    parser.add_argument('--grid-size', type=int, default=96,
                       help='Grid cell size for scanning (default: 96)')
    parser.add_argument('--risk-threshold', type=float, default=0.65,
                       help='Risk threshold for detection (default: 0.65)')
    parser.add_argument('--no-display', action='store_true',
                       help='Disable video display (processing only)')
    parser.add_argument('--scale', type=float, default=0.5,
                       help='Scale factor for processing (default: 0.5 for speed)')
    parser.add_argument('--skip-frames', type=int, default=2,
                       help='Process every Nth frame (default: 2 = every other frame)')
    parser.add_argument('--display-width', type=int, default=960,
                       help='Display window width (default: 960)')
    parser.add_argument('--save-output', type=str, default=None,
                       help='Save output video to file')
    parser.add_argument('--no-yolo', action='store_true',
                       help='Disable YOLOv8 person detection (use background subtraction instead)')
    parser.add_argument('--yolo-interval', type=int, default=2,
                       help='Run YOLO every Nth processed frame (default: 2). Lower = more accurate but slower')
    
    args = parser.parse_args()
    
    # Open video source
    if args.webcam:
        cap = cv2.VideoCapture(args.camera_index)
        print(f"📹 Using camera device {args.camera_index}...")
        if not cap.isOpened():
            print(f"⚠️  Camera {args.camera_index} not available, trying default camera (0)...")
            cap = cv2.VideoCapture(0)
        
        # Helpful tip for users
        if args.camera_index == 0:
            print("💡 TIP: To use Brio 100 or other camera, try: --camera-index 1")
    elif args.video:
        # Check if file exists
        if not os.path.exists(args.video):
            # Try looking in videos directory
            video_path = os.path.join('..', 'data', 'videos', args.video)
            if os.path.exists(video_path):
                args.video = video_path
            else:
                print(f"❌ Error: Video file not found: {args.video}")
                return
        
        cap = cv2.VideoCapture(args.video)
        print(f"📹 Loading video: {args.video}")
    else:
        print("❌ Error: Please specify --video or --webcam")
        return
    
    if not cap.isOpened():
        print("❌ Error: Cannot open video source")
        return
    
    # Get video properties
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    if fps == 0:
        fps = 30  # Default for webcam
    
    orig_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Processing resolution (scaled down for speed)
    proc_width = int(orig_width * args.scale)
    proc_height = int(orig_height * args.scale)
    
    # Display resolution (smaller window)
    display_scale = args.display_width / orig_width
    display_width = int(orig_width * display_scale)
    display_height = int(orig_height * display_scale)
    
    print(f"📐 Original: {orig_width}x{orig_height}")
    print(f"⚙️  Processing: {proc_width}x{proc_height} (scale={args.scale})")
    print(f"🖥️  Display: {display_width}x{display_height}")
    print(f"🔲 Grid size: {args.grid_size}px")
    print(f"⏩ Skip frames: {args.skip_frames} (process every {args.skip_frames+1}th frame)")
    print(f"⚠️  Risk threshold: {args.risk_threshold}")
    
    # Initialize crush risk detector
    use_yolo = not args.no_yolo
    detector = CrushRiskDetector(grid_size=args.grid_size, use_yolo=use_yolo)
    
    print(f"🔍 Detection method: {'YOLOv8 + Optical Flow' if use_yolo else 'Background Subtraction + Optical Flow'}")
    if use_yolo:
        print(f"⚡ YOLO runs every {args.yolo_interval} frames (caching detections for speed)")
    
    # Video writer (if saving)
    video_writer = None
    if args.save_output:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v') #type: ignore
        video_writer = cv2.VideoWriter(args.save_output, fourcc, fps, (display_width, display_height))
        print(f"💾 Saving output to: {args.save_output}")
    
    # Stats
    frame_count = 0
    processed_count = 0
    detection_count = 0
    paused = False
    last_detection_result = {'danger_zones': [], 'all_risks': []}
    
    print("\n" + "="*60)
    print("🚨 CROWD CRUSH RISK DETECTION")
    print("="*60)
    print("Scanning for dangerous crowd conditions...")
    print("Press 'q' to quit, 'p' to pause, 'r' to reset, 's' to screenshot")
    print("-" * 60)
    
    # Create resizable window
    if not args.no_display:
        cv2.namedWindow('Crowd Crush Risk Detection', cv2.WINDOW_NORMAL)
        cv2.resizeWindow('Crowd Crush Risk Detection', display_width, display_height)
    
    try:
        while True:
            if not paused:
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                    #print("\n✅ Video finished")
                    
                
                frame_count += 1
                
                # Only process every Nth frame for performance
                if frame_count % (args.skip_frames + 1) == 0:
                    processed_count += 1
                    
                    # Downscale for processing
                    proc_frame = cv2.resize(frame, (proc_width, proc_height))
                    
                    # Detect crush risk on downscaled frame
                    detection_result = detector.detect_crush_risk(proc_frame, yolo_interval=args.yolo_interval)
                    
                    # We MUST deep copy the detection result before modifying it (scaling it),
                    # otherwise we mutate the internal state of the detector!
                    import copy
                    
                    # Store original unmodified result for the skipped frames
                    last_detection_result = copy.deepcopy(detection_result)
                    
                    # Work on a copy so we don't mess up internal tracker
                    detection_result = copy.deepcopy(detection_result)
                    
                    # Scale detection coordinates back to original resolution
                    if detection_result['danger_zones']:
                        scale_x = orig_width / proc_width
                        scale_y = orig_height / proc_height
                        
                        for danger_zone in detection_result['danger_zones']:
                            # Scale danger zone
                            center = danger_zone['center']
                            danger_zone['center'] = (
                                int(center[0] * scale_x),
                                int(center[1] * scale_y)
                            )
                            danger_zone['radius'] = int(
                                danger_zone['radius'] * max(scale_x, scale_y)
                            )
                            
                            # Scale safe zone if present
                            if danger_zone.get('safe_zone'):
                                safe_zone = danger_zone['safe_zone']
                                safe_center = safe_zone['center']
                                # Ensure plain Python ints (not numpy types)
                                # Extract coordinates and convert step by step
                                x = safe_center[0]
                                y = safe_center[1]
                                # Handle numpy types
                                if hasattr(x, 'item'):
                                    x = x.item()
                                if hasattr(y, 'item'):
                                    y = y.item()
                                # Convert to Python int via float
                                safe_zone['center'] = (
                                    int(float(x) * float(scale_x)),
                                    int(float(y) * float(scale_y))
                                )
                                r = safe_zone['radius']
                                if hasattr(r, 'item'):
                                    r = r.item()
                                safe_zone['radius'] = int(float(r) * max(float(scale_x), float(scale_y)))
                                
                    # Store scaled result for drawing on skipped frames
                    import copy
                    display_detection_result = copy.deepcopy(detection_result)
                    
                else:
                    # Reuse last detection result - DEEP COPY to prevent exponential scaling!
                    import copy
                    if 'display_detection_result' in locals():
                        detection_result = copy.deepcopy(display_detection_result)
                    else:
                        detection_result = copy.deepcopy(last_detection_result) if last_detection_result else {'danger_zones': []}
                
                # Check if danger detected
                if detection_result['danger_zones']:
                    detection_count += 1
                    
                    # Log detection (every ~1 second)
                    if detection_count % 30 == 1:
                        print(f"\n⚠️  DANGER DETECTED at frame {frame_count}")
                        print(f"   Active zones: {detection_result.get('confirmed_zones_count', 0)}")
                        print(f"   Total tracking: {detection_result.get('active_zones_count', 0)}")
                        
                        # Show all active zones with persistence info
                        for danger in detection_result['danger_zones']:
                            zone_id = danger.get('zone_id', '?')
                            active_duration = danger.get('active_duration', 0)
                            last_detected = danger.get('last_detected', 0)
                            
                            print(f"\n   🔴 Zone #{zone_id}:")
                            print(f"     Risk: {danger['risk_score']:.2%}")
                            print(f"     Location: {danger['center']}")
                            print(f"     🚁 Active for: {active_duration:.1f}s (last seen: {last_detected:.1f}s ago)")
                            
                            metrics = danger['metrics']
                            print(f"     Metrics:")
                            print(f"       - Bidirectional Flow: {metrics['bidirectional']:.2f}")
                            print(f"       - Density: {metrics['density']:.2f}")
                            print(f"       - Flow Conflict: {metrics['flow_conflict']:.2f}")
                            print(f"       - Stop-Go Waves: {metrics['stop_go']:.2f}")
                
                # ── SHARE RAW FRAME (NO OVERLAYS) FOR INTERACTIVE FRONTEND ──────────
                global latest_raw_frame
                ret_raw, raw_buffer = cv2.imencode('.jpg', frame)
                if ret_raw:
                    with raw_frame_lock:
                        latest_raw_frame = raw_buffer.tobytes()
                # ─────────────────────────────────────────────────────────────────────
                
                # Draw circles on frame (for traditional display)
                output_frame = draw_crush_risk_circles(frame, detection_result)
                
                # ── SHARE RENDERED FRAME WITH FLASK ──────────────────────────────────
                global latest_frame
                ret_enc, buffer = cv2.imencode('.jpg', output_frame)
                if ret_enc:
                    with frame_lock:
                        latest_frame = buffer.tobytes()
                # ─────────────────────────────────────────────────────────────────────

                # Resize for display
                output_frame = cv2.resize(output_frame, (display_width, display_height))
                
                # ── Text overlay removed for dashboard view ──
                # All metrics now displayed in React frontend
                # Uncomment below if you want standalone CV window with overlays
                """
                info_y = 30
                cv2.rectangle(output_frame, (10, 10), (450, 90), (0, 0, 0), -1)
                cv2.putText(output_frame, "CROWD CRUSH RISK DETECTOR", (20, info_y),
                           cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 2)
                info_y += 25
                
                status_text = f"Frame: {frame_count} | Processed: {processed_count}"
                cv2.putText(output_frame, status_text, (20, info_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                info_y += 20
                
                if detection_result['danger_zones']:
                    num_zones = len(detection_result['danger_zones'])
                    max_risk = max(z['risk_score'] for z in detection_result['danger_zones'])
                    
                    # Show longest active zone for drone coordination
                    longest_zone = max(detection_result['danger_zones'], key=lambda z: z.get('active_duration', 0))
                    zone_id = longest_zone.get('zone_id', '?')
                    duration = longest_zone.get('active_duration', 0)
                    
                    risk_text = f"DANGER: Zone #{zone_id} ({duration:.1f}s) - {max_risk:.0%} risk"
                    cv2.putText(output_frame, risk_text, (20, info_y),
                               cv2.FONT_HERSHEY_DUPLEX, 0.6, (0, 0, 255), 2)
                else:
                    cv2.putText(output_frame, "Status: SAFE", (20, info_y),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                """
                
                # Save frame if writer enabled
                if video_writer:
                    video_writer.write(output_frame)
                
                # ── UPDATE SHARED DATA FOR FLASK ────────────────────────────────
                # Encode output_frame as JPEG for streaming
                ret_encode, buffer = cv2.imencode('.jpg', output_frame)
                if ret_encode:
                    with frame_lock:
                        latest_frame = buffer.tobytes()
                
                # Update detection data for API (include safe zones for frontend)
                with data_lock:
                    global latest_detection_data
                    latest_detection_data = {
                        'frame_count': frame_count,
                        'processed_count': processed_count,
                        'detection_count': detection_count,
                        'danger_zones': len(detection_result.get('danger_zones', [])),
                        'max_risk': max([z['risk_score'] for z in detection_result.get('danger_zones', [])], default=0),
                        'zones': [{
                            'id': z.get('zone_id', i),
                            'risk_score': z['risk_score'],
                            'center': z['center'],
                            'radius': z['radius'],
                            'safe_zone': z.get('safe_zone'),  # Include safe zone for frontend
                            'active_duration': z.get('active_duration', 0),
                            'metrics': z['metrics'],
                            'person_count': z.get('person_count', 0)
                        } for i, z in enumerate(detection_result.get('danger_zones', []))],
                        'timestamp': frame_count / fps if fps > 0 else 0,
                        'frame_size': {'width': orig_width, 'height': orig_height}  # For frontend scaling
                    }
                # ─────────────────────────────────────────────────────────────────
                
                # Display
                if not args.no_display:
                    cv2.imshow('Crowd Crush Risk Detection', output_frame)
            
            # Handle keyboard input (wait time matches FPS for real-time playback)
            wait_time = int(1000 / fps) if not paused else 100
            key = cv2.waitKey(wait_time) & 0xFF
            
            if key == ord('q'):
                print("\n🛑 Quitting...")
                break
            elif key == ord('p'):
                paused = not paused
                status = "PAUSED" if paused else "RESUMED"
                print(f"\n⏸️  {status}")
            elif key == ord('r'):
                detector.reset()
                print("\n🔄 Detector reset")
            elif key == ord('s'):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"crush_detection_{timestamp}.jpg"
                cv2.imwrite(filename, output_frame)
                print(f"\n📸 Screenshot saved: {filename}")
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    
    finally:
        # Cleanup
        cap.release()
        if video_writer:
            video_writer.release()
        if not args.no_display:
            cv2.destroyAllWindows()
        
        # Final stats
        print("\n" + "="*60)
        print("📊 DETECTION SUMMARY")
        print("="*60)
        print(f"Total frames: {frame_count}")
        print(f"Processed frames: {processed_count}")
        print(f"Danger detections: {detection_count}")
        if processed_count > 0:
            print(f"Detection rate: {100*detection_count/processed_count:.1f}%")
        print("="*60)


# if __name__ == '__main__':
#    main()



# #aithy addd
if __name__ == '__main__':
    # ── START VIDEO PROCESSING IN BACKGROUND THREAD ──────────────────────────
    # main() runs the video loop in a separate thread so Flask can run
    # at the same time without blocking.
    t = threading.Thread(target=main)
    t.daemon = True
    t.start()

    # ── START FLASK SERVER ────────────────────────────────────────────────────
    # React's SimulatedView.jsx points its <img> src at localhost:5000/video_feed
    # Change the port here if 5000 is already in use on your machine.
    print("🌐 Starting Flask stream server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
    # ─