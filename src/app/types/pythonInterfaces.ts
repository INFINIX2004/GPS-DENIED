// Python Backend Interface Types
// Data structures matching the AeroVision Python system output

/**
 * Raw data structure from Python AeroVision system
 * This matches the format sent by the Python backend
 */
export interface PythonSystemData {
  system: PythonSystemStatus;
  tracks: PythonTrack[];
  alerts: PythonAlert[];
  video?: PythonVideoStatus;
  timestamp: string;
}

/**
 * Python system status data structure
 */
export interface PythonSystemStatus {
  power_mode: 'IDLE' | 'ACTIVE' | 'ALERT';
  power_w: number;
  battery_minutes: number;
  fps: number;
  camera_status: 'CONNECTED' | 'DISCONNECTED';
  processing_status?: string;
  timestamp: string;
}

/**
 * Python track/intruder data structure
 */
export interface PythonTrack {
  id: number;
  zone: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
  threat_score: number;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detection_time: number; // seconds since detection
  behavior: PythonBehaviorData;
  prediction: PythonPredictionData;
  explanation: PythonExplanationItem[];
}

/**
 * Python behavioral analysis data
 */
export interface PythonBehaviorData {
  loitering: {
    active: boolean;
    duration?: number;
  };
  speed_anomaly: boolean;
  trajectory_confidence: number; // 0.0 - 1.0
  trajectory_stability?: 'stable' | 'moderate' | 'erratic';
}

/**
 * Python prediction data structure
 */
export interface PythonPredictionData {
  near: PythonPredictionItem; // 3s
  medium: PythonPredictionItem; // 6s
  far: PythonPredictionItem; // 10s
  will_enter_restricted?: boolean;
  overall_confidence?: number; // 0.0 - 1.0
}

/**
 * Individual prediction item from Python
 */
export interface PythonPredictionItem {
  zone: string;
  confidence: number; // 0.0 - 1.0
  description?: string;
}

/**
 * Python threat explanation item
 */
export interface PythonExplanationItem {
  factor: string;
  points: number;
  description?: string;
}

/**
 * Python alert data structure
 */
export interface PythonAlert {
  id?: string;
  time: string;
  message: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  track_id?: number;
}

/**
 * Python video status data
 */
export interface PythonVideoStatus {
  is_live: boolean;
  resolution: {
    width: number;
    height: number;
  };
  latency_ms: number;
  source: 'webcam' | 'drone' | 'rtsp' | 'mjpeg';
  stream_url?: string;
  frame_rate?: number;
  bitrate_kbps?: number;
}

/**
 * Python zone status data (for overlay migration)
 */
export interface PythonZoneStatus {
  zone_id: string;
  zone_name: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
  active_tracks: number;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  last_violation?: string; // timestamp
}

/**
 * Python power metrics (for overlay migration)
 */
export interface PythonPowerMetrics {
  current_mode: 'IDLE' | 'ACTIVE' | 'ALERT';
  power_consumption_w: number;
  battery_remaining_min: number;
  estimated_runtime_min: number;
  power_efficiency: number; // 0.0 - 1.0
}

/**
 * WebSocket message wrapper from Python
 */
export interface PythonWebSocketMessage {
  type: 'system_update' | 'track_update' | 'alert' | 'heartbeat';
  timestamp: string;
  data: PythonSystemData | PythonTrack | PythonAlert | null;
}

/**
 * REST API response wrapper from Python
 */
export interface PythonApiResponse {
  success: boolean;
  timestamp: string;
  data?: PythonSystemData;
  error?: string;
  version?: string;
}

/**
 * Python configuration/status endpoint response
 */
export interface PythonConfigResponse {
  system_id: string;
  version: string;
  capabilities: string[];
  update_frequency_hz: number;
  supported_protocols: ('websocket' | 'rest' | 'rtsp' | 'mjpeg')[];
  zones: PythonZoneStatus[];
}

/**
 * Type guards for Python data validation
 */
export function isPythonSystemData(data: any): data is PythonSystemData {
  return (
    data !== null &&
    data !== undefined &&
    typeof data === 'object' &&
    data.system &&
    Array.isArray(data.tracks) &&
    Array.isArray(data.alerts) &&
    typeof data.timestamp === 'string'
  );
}

export function isPythonTrack(data: any): data is PythonTrack {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.id === 'number' &&
    typeof data.zone === 'string' &&
    typeof data.threat_score === 'number' &&
    typeof data.threat_level === 'string' &&
    typeof data.detection_time === 'number' &&
    data.behavior &&
    data.prediction &&
    Array.isArray(data.explanation)
  );
}

export function isPythonWebSocketMessage(data: any): data is PythonWebSocketMessage {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.type === 'string' &&
    typeof data.timestamp === 'string' &&
    ['system_update', 'track_update', 'alert', 'heartbeat'].includes(data.type)
  );
}