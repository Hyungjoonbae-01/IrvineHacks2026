# Crowd Crush Risk Detection
# Dynamically scans entire frame for dangerous crowd conditions
# Inspired by Itaewon crowd crush incident analysis
# 
# Risk Factors:
# 1. High density (>0.7 packed people)
# 2. Bidirectional flow (people pushing in opposite directions)
# 3. Stop-go oscillations (pressure waves)
# 4. Low mobility (trapped, can't escape)

import cv2
import numpy as np
import time
from collections import deque
from ultralytics import YOLO


class CrushRiskDetector:
    """
    Detects crowd crush risk by scanning frame dynamically.
    
    Uses YOLOv8 for accurate person detection + optical flow for motion analysis.
    
    Unlike zone-based detection, this scans the entire frame with a sliding
    grid to find dangerous conditions that could lead to crowd crushing.
    
    Based on research from Itaewon incident and crowd dynamics papers:
    - High density + opposing flows = crush risk
    - Stop-go waves indicate pressure buildup
    - Bidirectional movement creates dangerous forces
    """
    
    def __init__(self, grid_size=64, history_size=10, use_yolo=True):
        """
        Initialize crush risk detector.
        
        Args:
            grid_size: Size of grid cells for scanning (pixels)
            history_size: Number of frames to track for oscillation detection
            use_yolo: Use YOLOv8 for person detection (more accurate density)
        """
        self.grid_size = grid_size
        self.history_size = history_size
        self.use_yolo = use_yolo
        
        # YOLOv8 nano model for person detection (fast + accurate)
        if self.use_yolo:
            try:
                import torch
                # Detect if CUDA is available
                cuda_available = torch.cuda.is_available()
                device = 'cuda:0' if cuda_available else 'cpu'
                
                self.yolo_model = YOLO('yolov8n.pt')  # Nano model for speed
                
                if cuda_available:
                    device_name = torch.cuda.get_device_name(0)
                    print(f"✅ YOLOv8 loaded with CUDA acceleration ({device_name})")
                else:
                    print("✅ YOLOv8 loaded (CPU mode - install PyTorch with CUDA for 5-10x speedup)")
            except Exception as e:
                print(f"⚠️  YOLOv8 loading failed: {e}, falling back to background subtraction")
                self.use_yolo = False
                self.yolo_model = None
        else:
            self.yolo_model = None
        
        # Background subtractor (fallback if YOLO disabled)
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500,
            varThreshold=16,
            detectShadows=False
        )
        
        # Tracking state
        self.prev_frame = None
        self.cell_history = {}  # (row, col) -> deque of speed values
        self.risk_smoothing = {}  # (row, col) -> smoothed risk score
        self.smoothing_alpha = 0.3  # EMA smoothing factor
        
        # YOLO detection caching for performance
        self.cached_person_detections = []  # Cache last YOLO detection
        self.yolo_frame_counter = 0  # Track when to run YOLO
        
        # 🚁 DANGER ZONE PERSISTENCE (for drone coordination)
        # Keep zones active long enough for hardware to respond
        self.active_zones = {}  # zone_id -> {first_seen, last_seen, last_update, zone_data, confirmed}
        self.min_zone_duration = 10.0  # Minimum seconds to keep zone active (drone flight time)
        self.zone_confirmation_frames = 3  # Require N consecutive frames before confirming
        self.zone_merge_distance = 100  # Pixels - zones closer than this are same location
        self.next_zone_id = 0  # Unique zone ID counter
         
    def detect_crush_risk(self, frame, yolo_interval=2):
        """
        Scan frame for crowd crush risk areas.
        
        Args:
            frame: RGB/BGR video frame
            yolo_interval: Run YOLO every Nth call (default: 2 = every other frame)
            
        Returns:
            Dictionary with:
                - danger_zones: List of danger zone dicts
                - all_risks: List of all risky cells with scores
        """
        if frame is None or frame.size == 0:
            return {'danger_zone': None, 'safe_zone': None, 'all_risks': []}
        
        height, width = frame.shape[:2]
        
        # Convert to grayscale for optical flow
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        
        # Compute optical flow if we have previous frame
        flow = None
        if self.prev_frame is not None:
            # OpenCV accepts None for flow parameter (auto-allocation)
            # Optimized parameters for speed: fewer levels, smaller window
            flow = cv2.calcOpticalFlowFarneback(  # type: ignore
                self.prev_frame, gray,
                None,  # type: ignore
                pyr_scale=0.5,
                levels=2,           # Reduced from 3 for speed
                winsize=10,         # Reduced from 15 for speed
                iterations=2,       # Reduced from 3 for speed
                poly_n=5,
                poly_sigma=1.1,
                flags=0
            )
        
        # Apply background subtraction for density (fallback)
        fg_mask = self.bg_subtractor.apply(frame)
        
        # YOLOv8 person detection for accurate density
        # Use cached detections if within interval (2-3x speed boost)
        person_detections = []
        if self.use_yolo and self.yolo_model is not None:
            self.yolo_frame_counter += 1
            
            
            # Only run YOLO every Nth frame
            if self.yolo_frame_counter >= yolo_interval:
                self.yolo_frame_counter = 0
                try:
                    # Run YOLO detection (class 0 = person)
                    # CUDA acceleration happens automatically if available
                    results = self.yolo_model(frame, verbose=False, classes=[0])
                    
                    # Extract person bounding boxes
                    if len(results) > 0 and results[0].boxes is not None:
                        boxes = results[0].boxes
                        person_detections = []
                        for box in boxes:
                            # Get box coordinates
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            conf = box.conf[0].cpu().numpy()
                            
                            # Only use high-confidence detections
                            if conf > 0.3:
                                person_detections.append({
                                    'bbox': (int(x1), int(y1), int(x2), int(y2)),
                                    'center': (int((x1 + x2) / 2), int((y1 + y2) / 2)),
                                    'confidence': float(conf)
                                })
                        
                        # Cache the detections
                        self.cached_person_detections = person_detections
                except Exception as e:
                    # Fallback to background subtraction if YOLO fails
                    pass
            else:
                # Use cached detections (people don't teleport between frames)
                person_detections = self.cached_person_detections
        
        # Scan frame with sliding grid
        risk_cells = []
        rows = height // self.grid_size
        cols = width // self.grid_size
        
        for row in range(rows):
            for col in range(cols):
                y1 = row * self.grid_size
                y2 = min(y1 + self.grid_size, height)
                x1 = col * self.grid_size
                x2 = min(x1 + self.grid_size, width)
                
                cell_key = (row, col)
                
                # Extract cell regions
                fg_cell = fg_mask[y1:y2, x1:x2]
                
                # Calculate density using YOLO or fallback to background subtraction
                people_in_cell = 0
                if person_detections:
                    # Count people whose center is in this grid cell
                    people_in_cell = sum(
                        1 for p in person_detections
                        if x1 <= p['center'][0] < x2 and y1 <= p['center'][1] < y2
                    )
                    # Density based on person count (normalize by expected max)
                    # Assume max 10 people per grid cell for normalization
                    max_people_per_cell = 10
                    density = min(people_in_cell / max_people_per_cell, 1.0)
                else:
                    # Fallback: use background subtraction
                    density = self._calculate_density(fg_cell)
                
                # Calculate flow metrics (if flow available)
                flow_conflict = 0.0
                bidirectional_score = 0.0
                avg_speed = 0.0
                
                if flow is not None:
                    flow_cell = flow[y1:y2, x1:x2]
                    flow_conflict, bidirectional_score, avg_speed = self._analyze_flow_conflict(flow_cell)
                    
                    # Track speed history for stop-go detection
                    if cell_key not in self.cell_history:
                        self.cell_history[cell_key] = deque(maxlen=self.history_size)
                    self.cell_history[cell_key].append(avg_speed)
                
                # Calculate stop-go oscillation
                stop_go_score = self._calculate_stop_go(cell_key)
                
                # COMBINE INTO CRUSH RISK SCORE
                # Higher score = more dangerous
                # 🚨 KEY INSIGHT: Bidirectional flow at LOW density is NORMAL (crosswalks, open spaces)
                # DANGER only exists when: HIGH density + OPPOSING MOTION = crushing pressure
                # 
                # Formula: BOTH density AND bidirectional flow must be high
                #          Either one alone is safe
                
                # Gate 1: If density too low, it's safe (even if bidirectional)
                # At low density, people have space to move around each other
                if density < 0.4:
                    base_risk = 0.0  # Safe - people have space to navigate
                # Gate 2: If no bidirectional flow, it's safe (even if dense)
                # Dense unidirectional crowds are normal at events
                elif bidirectional_score < 0.4:
                    base_risk = 0.0  # Safe - dense crowd moving together
                else:
                    # BOTH conditions met: high density + opposing flows = DANGER
                    # Weighted risk from motion patterns
                    base_risk = (
                        0.65 * bidirectional_score +    # PRIMARY: Opposing flows
                        0.25 * flow_conflict +          # Secondary: Chaotic directions  
                        0.10 * stop_go_score            # Tertiary: Pressure waves
                    )
                
                # Density multiplier: amplifies risk when very high density present
                # Formula: 0.3 (baseline) + 0.7*density
                # - Med density (0.5): multiplier = 0.65x
                # - High density (0.7): multiplier = 0.79x  
                # - Very high (0.9): multiplier = 0.93x
                density_multiplier = 0.3 + 0.7 * density
                
                risk_score = base_risk * density_multiplier
                
                # Apply exponential smoothing to prevent "popping"
                if cell_key in self.risk_smoothing:
                    risk_score = (self.smoothing_alpha * risk_score + 
                                 (1 - self.smoothing_alpha) * self.risk_smoothing[cell_key])
                self.risk_smoothing[cell_key] = risk_score
                
                # Only consider cells with meaningful risk (higher threshold)
                # 0.5 = requires BOTH moderate density AND bidirectional flow
                if risk_score > 0.55:  # Lowered to detect opposing flows more reliably
                    risk_cells.append({
                        'row': row,
                        'col': col,
                        'center': (x1 + self.grid_size // 2, y1 + self.grid_size // 2),
                        'risk_score': risk_score,
                        'density': density,
                        'bidirectional': bidirectional_score,
                        'flow_conflict': flow_conflict,
                        'stop_go': stop_go_score,
                        'person_count': people_in_cell,
                    })
        
        # Build all danger zones (can be multiple)
        current_time = time.time()
        newly_detected_zones = []
        
        if risk_cells:
            # Sort by risk score
            risk_cells.sort(key=lambda x: x['risk_score'], reverse=True)
            
            # Create danger zone for each risky cell
            # Limit to top 5 to avoid clutter
            for cell in risk_cells[:5]:
                # Define danger zone (red circle)
                # Size based on density and risk (0.75x smaller than original)
                base_radius = self.grid_size
                danger_radius = int(base_radius * (0.6 + 0.3 * cell['density']))
                
                # Green circle should be just around where arrows end
                # Arrow length = danger_radius * 0.4, starting at danger_radius * 1.05
                arrow_length = danger_radius * 0.4
                safe_radius = int(danger_radius * 1.05 + arrow_length + 10)  # +10px padding
                
                danger_zone = {
                    'center': cell['center'],
                    'radius': danger_radius,
                    'risk_score': cell['risk_score'],
                    'person_count': cell.get('person_count', 0),
                    'metrics': {
                        'density': cell['density'],
                        'bidirectional': cell['bidirectional'],
                        'flow_conflict': cell['flow_conflict'],
                        'stop_go': cell['stop_go'],
                    },
                    # ALWAYS include safe zone for consistent visualization
                    'safe_zone': {
                        'center': cell['center'],
                        'radius': safe_radius
                    }
                }
                
                newly_detected_zones.append(danger_zone)
        
        # Match newly detected zones to existing active zones
        matched_zone_ids = set()
        
        for new_zone in newly_detected_zones:
            # Find if this matches an existing active zone (same location)
            matched_id = None
            for zone_id, zone_info in self.active_zones.items():
                if self._zones_match(new_zone['center'], zone_info['zone_data']['center']):
                    matched_id = zone_id
                    break
            
            if matched_id is not None:
                # Update existing zone - preserve original radius and center to keep visualization perfectly stable
                existing_zone = self.active_zones[matched_id]['zone_data']
                
                # Update timestamps and metrics but KEEP original center/radius/safe_zone locked 
                # so the drone deployment target remains stable
                existing_zone['risk_score'] = new_zone['risk_score']
                existing_zone['metrics'] = new_zone['metrics']
                existing_zone['person_count'] = new_zone.get('person_count', 0)
                # existing_zone['center'] = new_zone['center']  # DO NOT update position, keep it locked
                # radius and safe_zone stay the same (locked at first detection)
                
                self.active_zones[matched_id]['last_seen'] = current_time
                self.active_zones[matched_id]['last_update'] = current_time
                self.active_zones[matched_id]['detection_count'] = self.active_zones[matched_id].get('detection_count', 0) + 1
                
                # Confirm zone after N consecutive detections
                if self.active_zones[matched_id]['detection_count'] >= self.zone_confirmation_frames:
                    self.active_zones[matched_id]['confirmed'] = True
                
                matched_zone_ids.add(matched_id)
            else:
                # Create new zone
                zone_id = self.next_zone_id
                self.next_zone_id += 1
                
                self.active_zones[zone_id] = {
                    'zone_id': zone_id,
                    'first_seen': current_time,
                    'last_seen': current_time,
                    'last_update': current_time,
                    'zone_data': new_zone,
                    'confirmed': False,  # Not confirmed until seen N frames
                    'detection_count': 1
                }
                matched_zone_ids.add(zone_id)
        
        # Clean up expired zones
        # Only remove zones that:
        # 1. Haven't been seen recently (5 seconds)
        # 2. AND have existed for minimum duration (10 seconds)
        zones_to_remove = []
        for zone_id, zone_info in self.active_zones.items():
            time_since_last_seen = current_time - zone_info['last_seen']
            time_since_first_seen = current_time - zone_info['first_seen']
            
            # Remove if: not seen for 5 seconds AND (not confirmed OR existed long enough)
            if time_since_last_seen > 5.0:
                if not zone_info['confirmed'] or time_since_first_seen > self.min_zone_duration:
                    zones_to_remove.append(zone_id)
        
        for zone_id in zones_to_remove:
            del self.active_zones[zone_id]
        
        # Build final danger zones list from all active confirmed zones
        danger_zones = []
        for zone_id, zone_info in self.active_zones.items():
            if zone_info['confirmed']:  # Only show confirmed zones
                import copy
                zone_data = copy.deepcopy(zone_info['zone_data'])
                
                # Add persistence metadata for drone coordination
                zone_data['zone_id'] = zone_id
                zone_data['active_duration'] = current_time - zone_info['first_seen']
                zone_data['last_detected'] = current_time - zone_info['last_seen']
                
                danger_zones.append(zone_data)
        
        # Update previous frame
        self.prev_frame = gray.copy()
        
        return {
            'danger_zones': danger_zones,  # List of all persistent danger zones
            'all_risks': risk_cells,
            'active_zones_count': len(self.active_zones),
            'confirmed_zones_count': len(danger_zones)
        }
    
    def _calculate_density(self, fg_mask):
        """Calculate density from foreground mask."""
        if fg_mask.size == 0:
            return 0.0
        
        foreground_pixels = np.count_nonzero(fg_mask)
        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        
        density = foreground_pixels / total_pixels
        # Normalize (cap at reasonable max)
        density = min(density * 2.5, 1.0)
        
        return density
    
    def _analyze_flow_conflict(self, flow_cell):
        """
        Analyze optical flow for conflict/opposing directions.
        
        Returns:
            (flow_conflict, bidirectional_score, avg_speed)
            
            - flow_conflict: Variance in flow directions (0-1)
            - bidirectional_score: Measure of opposing flows (0-1)
            - avg_speed: Average flow magnitude
        """
        if flow_cell.size == 0:
            return 0.0, 0.0, 0.0
        
        # Extract flow vectors
        fx = flow_cell[:, :, 0]
        fy = flow_cell[:, :, 1]
        
        # Calculate magnitude and angle
        magnitude = np.sqrt(fx**2 + fy**2)
        angle = np.arctan2(fy, fx)
        
        # Filter out noise (low magnitude)
        valid_mask = magnitude > 0.5
        
        if np.sum(valid_mask) == 0:
            return 0.0, 0.0, 0.0
        
        valid_magnitudes = magnitude[valid_mask]
        valid_angles = angle[valid_mask]
        
        # Average speed
        avg_speed = float(np.mean(valid_magnitudes))
        
        # Flow conflict (circular variance of angles)
        # High variance = chaotic, conflicting directions
        flow_conflict = self._circular_variance(valid_angles)
        
        # Bidirectional score (KEY METRIC for crush detection)
        # Detect if significant flow exists in OPPOSITE directions
        # This is dangerous: people pushing left AND right simultaneously
        bidirectional_score = self._detect_bidirectional_flow(fx, fy, valid_mask)
        
        return flow_conflict, bidirectional_score, avg_speed
    
    def _circular_variance(self, angles):
        """Calculate circular variance for angles (0-1)."""
        if len(angles) == 0:
            return 0.0
        
        # Mean direction vector
        mean_sin = np.mean(np.sin(angles))
        mean_cos = np.mean(np.cos(angles))
        
        # Resultant length (0-1, where 1 = all same direction)
        R = np.sqrt(mean_sin**2 + mean_cos**2)
        
        # Circular variance (0 = consistent, 1 = random)
        return 1.0 - R
    
    def _detect_bidirectional_flow(self, fx, fy, valid_mask):
        """
        Detect bidirectional flow (opposing directions).
        
        This is the KEY indicator of crowd crush risk:
        - People pushing left AND right = dangerous pressure
        - People pushing forward AND backward = dangerous pressure
        
        Returns:
            Score 0-1 where 1 = strong opposing flows
        """
        if np.sum(valid_mask) < 10:  # Need enough samples
            return 0.0
        
        valid_fx = fx[valid_mask]
        valid_fy = fy[valid_mask]
        
        # Check horizontal opposition (left vs right)
        left_flow = np.sum(valid_fx < -0.3)   # Moving left (lowered from -0.5)
        right_flow = np.sum(valid_fx > 0.3)   # Moving right (lowered from 0.5)
        
        total_horizontal = left_flow + right_flow
        if total_horizontal > 0:
            h_balance = min(left_flow, right_flow) / total_horizontal
            horizontal_opposition = 2 * h_balance  # Normalize to 0-1
        else:
            horizontal_opposition = 0.0
        
        # Check vertical opposition (up vs down)
        up_flow = np.sum(valid_fy < -0.3)     # Moving up (lowered from -0.5)
        down_flow = np.sum(valid_fy > 0.3)    # Moving down (lowered from 0.5)
        
        total_vertical = up_flow + down_flow
        if total_vertical > 0:
            v_balance = min(up_flow, down_flow) / total_vertical
            vertical_opposition = 2 * v_balance
        else:
            vertical_opposition = 0.0
        
        # Take maximum opposition
        bidirectional_score = max(horizontal_opposition, vertical_opposition)
        
        return min(bidirectional_score, 1.0)
    
    def _zones_match(self, center1, center2):
        """
        Check if two zone centers are close enough to be considered same zone.
        
        Args:
            center1: (x, y) tuple
            center2: (x, y) tuple
            
        Returns:
            True if zones should be merged (same physical location)
        """
        dx = center1[0] - center2[0]
        dy = center1[1] - center2[1]
        distance = np.sqrt(dx*dx + dy*dy)
        return distance < self.zone_merge_distance
    
    def _calculate_stop_go(self, cell_key):
        """Calculate stop-go oscillation score from speed history."""
        if cell_key not in self.cell_history:
            return 0.0
        
        history = list(self.cell_history[cell_key])
        if len(history) < 3:
            return 0.0
        
        # Count transitions between stopped and moving
        stop_threshold = 1.0
        transitions = 0
        
        for i in range(1, len(history)):
            prev_moving = history[i-1] > stop_threshold
            curr_moving = history[i] > stop_threshold
            if prev_moving != curr_moving:
                transitions += 1
        
        # Normalize by max possible transitions
        max_transitions = len(history) - 1
        oscillation_rate = transitions / max_transitions if max_transitions > 0 else 0
        
        # Speed variance component
        mean_speed = np.mean(history)
        speed_std = np.std(history)
        
        # Combined score
        score = 0.7 * oscillation_rate + 0.3 * min(speed_std / 5.0, 1.0)
        
        return min(score, 1.0)
    
    def reset(self):
        """Reset detector state."""
        self.prev_frame = None
        self.cell_history.clear()
        self.risk_smoothing.clear()
        self.cached_person_detections = []
        self.yolo_frame_counter = 0
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500,
            varThreshold=16,
            detectShadows=False
        )


def draw_crush_risk_circles(frame, detection_result):
    """
    Draw risk visualization circles on frame.
    
    Args:
        frame: Video frame
        detection_result: Output from CrushRiskDetector.detect_crush_risk()
        
    Returns:
        Frame with circles drawn
    """
    output = frame.copy()
    
    danger_zones = detection_result.get('danger_zones', [])
    
    if not danger_zones:
        return output
    
    # Draw all danger zones
    for danger_zone in danger_zones:
        center = danger_zone['center']
        danger_radius = danger_zone['radius']
        risk_score = danger_zone['risk_score']
        safe_zone = danger_zone.get('safe_zone')
        
        # Ensure center is a tuple of ints (not numpy types)
        # Handle both regular values and numpy arrays
        def to_python_int(val):
            """Safely convert to Python int, handling numpy types and floats"""
            # First, extract the value if it's a numpy type
            if hasattr(val, 'item'):  # numpy scalar
                val = val.item()
            # Now convert to Python int via float (handles remaining edge cases)
            return int(float(val))
        
        center = (to_python_int(center[0]), to_python_int(center[1]))
        danger_radius = to_python_int(danger_radius)
        
        # Draw safe zone (GREEN outer circle)
        if safe_zone:
            safe_center = safe_zone.get('center')
            safe_radius = safe_zone.get('radius')
            
            # Ensure safe zone coords are tuples of ints
            if safe_center is not None and safe_radius is not None:
                try:
                    # Force conversion to native Python types
                    x_coord = to_python_int(safe_center[0])
                    y_coord = to_python_int(safe_center[1])
                    
                    safe_center = (x_coord, y_coord)
                    safe_radius = to_python_int(safe_radius)
                    
                    # Green circle (where people should move TO)
                    cv2.circle(output, safe_center, safe_radius, (0, 255, 0), 3, lineType=cv2.LINE_AA)
                    
                    # Add arrow indicators pointing outward (SHORT arrows, not extending all the way)
                    num_arrows = 8
                    arrow_length = danger_radius * 0.4  # Short arrows (40% of danger radius)
                    for i in range(num_arrows):
                        angle = (2 * np.pi * i) / num_arrows
                        # Start at danger edge
                        start_x = int(center[0] + danger_radius * 1.05 * np.cos(angle))
                        start_y = int(center[1] + danger_radius * 1.05 * np.sin(angle))
                        # End just outside danger zone (short arrow)
                        end_x = int(start_x + arrow_length * np.cos(angle))
                        end_y = int(start_y + arrow_length * np.sin(angle))
                        
                        cv2.arrowedLine(output, (start_x, start_y), (end_x, end_y), 
                                      (0, 255, 0), 2, tipLength=0.4, line_type=cv2.LINE_AA)
                except (TypeError, ValueError, IndexError) as e:
                    # Skip drawing if conversion fails
                    pass
        
        # Draw danger zone (RED filled circle with pulsing effect)
        # Pulsing based on risk score
        alpha = 0.3 + 0.2 * risk_score  # Higher risk = more opaque
        
        # Create overlay for transparency
        overlay = output.copy()
        cv2.circle(overlay, center, danger_radius, (0, 0, 255), -1, lineType=cv2.LINE_AA)  # Filled red
        cv2.addWeighted(overlay, alpha, output, 1 - alpha, 0, output)
        
        # Red border
        cv2.circle(output, center, danger_radius, (0, 0, 255), 3, lineType=cv2.LINE_AA)
        
        # Add zone ID and duration (for drone coordination)
        zone_id = danger_zone.get('zone_id', '?')
        active_duration = danger_zone.get('active_duration', 0)
        
        # Main warning text with zone ID
        text = f"ZONE #{zone_id}: {risk_score:.0%} RISK"
        font = cv2.FONT_HERSHEY_DUPLEX
        text_size = cv2.getTextSize(text, font, 0.6, 2)[0]
        text_x = center[0] - text_size[0] // 2
        text_y = center[1] - danger_radius - 30  # Higher up to make room
        
        # Background for text
        cv2.rectangle(output, 
                     (text_x - 5, text_y - text_size[1] - 5),
                     (text_x + text_size[0] + 5, text_y + 5),
                     (0, 0, 0), -1)
        
        cv2.putText(output, text, (text_x, text_y), font, 0.6, (0, 0, 255), 2, cv2.LINE_AA)
        
        # Add active duration (for drone coordination)
        duration_text = f"Active: {active_duration:.1f}s"
        cv2.putText(output, duration_text, (text_x, text_y + 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 0), 1, cv2.LINE_AA)
        
        # Add metrics below
        metrics = danger_zone.get('metrics', {})
        info_text = f"BiDir:{metrics.get('bidirectional', 0):.2f} | D:{metrics.get('density', 0):.2f}"
        cv2.putText(output, info_text, (text_x, text_y + 38), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)
    
    return output


