// System State Types
// Central data structures for AeroVision Dashboard Integration

/**
 * Central System State containing all surveillance data
 * This is the single source of truth for dashboard components
 */
export interface SystemState {
  systemStatus: SystemStatusData;
  intruders: IntruderData[];
  threatIntelligence: Record<string, ThreatIntelligenceData>;
  alerts: AlertsData;
  videoStatus: VideoStatusData;
  metadata: SystemMetadata;
}

/**
 * System metadata for connection and data source tracking
 */
export interface SystemMetadata {
  lastUpdated: string;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  dataSource: 'websocket' | 'rest' | 'mock';
  updateFrequency?: number; // Hz
  errorCount?: number;
}

/**
 * System status data for SystemStatus component
 * Maps Python power management and system metrics
 */
export interface SystemStatusData {
  powerMode: 'IDLE' | 'ACTIVE' | 'ALERT';
  powerConsumption: number; // watts
  batteryRemaining: number; // minutes
  fps: number;
  processingStatus: string;
  cameraStatus: 'Connected' | 'Lost';
  timestamp: string;
}

/**
 * Individual intruder/track data for IntruderList component
 * Represents tracked objects with threat assessment
 */
export interface IntruderData {
  trackId: string; // formatted as TRK-001
  zone: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
  threatScore: number; // 0-100
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timeSinceDetection: number; // seconds
}

/**
 * Detailed threat analysis for ThreatIntelligence component
 * Contains behavioral analysis and predictions for selected intruders
 */
export interface ThreatIntelligenceData {
  threatBreakdown: ThreatBreakdownItem[];
  behavioral: BehavioralAnalysis;
  prediction: PredictionAnalysis;
}

/**
 * Individual threat factor contribution
 */
export interface ThreatBreakdownItem {
  factor: string;
  score: number;
}

/**
 * Behavioral analysis data
 */
export interface BehavioralAnalysis {
  loitering: boolean;
  loiteringDuration?: number; // seconds
  speedAnomaly: boolean;
  trajectoryStability: 'Stable' | 'Moderate' | 'Erratic';
  trajectoryConfidence: number; // percentage (0-100)
}

/**
 * Trajectory prediction analysis
 */
export interface PredictionAnalysis {
  nearTerm: string; // 3s prediction description
  mediumTerm: string; // 6s prediction description
  farTerm: string; // 10s prediction description
  confidence: 'High' | 'Medium' | 'Low';
  willEnterRestricted: boolean;
}

/**
 * System-wide alert status for AlertsPanel component
 */
export interface AlertsData {
  alertLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  recentAlerts: AlertItem[];
}

/**
 * Individual alert item
 */
export interface AlertItem {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
}

/**
 * Video feed metadata for VideoFeed component
 */
export interface VideoStatusData {
  isLive: boolean;
  resolution: string;
  latency: number; // milliseconds
  source: 'webcam' | 'drone' | 'placeholder';
  streamUrl?: string;
  frameRate?: number;
  bitrate?: number; // kbps
}

/**
 * Connection status enumeration
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Data source enumeration
 */
export type DataSource = 'websocket' | 'rest' | 'mock';

/**
 * Update frequency configuration
 */
export interface UpdateFrequencyConfig {
  websocket: number; // Hz for WebSocket updates
  rest: number; // Hz for REST polling
  mock: number; // Hz for mock data updates
}

/**
 * Default empty states for graceful degradation
 */
export const DEFAULT_SYSTEM_STATE: SystemState = {
  systemStatus: {
    powerMode: 'IDLE',
    powerConsumption: 0,
    batteryRemaining: 0,
    fps: 0,
    processingStatus: 'Offline',
    cameraStatus: 'Lost',
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
  },
  intruders: [],
  threatIntelligence: {},
  alerts: {
    alertLevel: 'NORMAL',
    recommendation: 'System offline - no active monitoring',
    recentAlerts: []
  },
  videoStatus: {
    isLive: false,
    resolution: '0x0',
    latency: 0,
    source: 'placeholder'
  },
  metadata: {
    lastUpdated: new Date().toISOString(),
    connectionStatus: 'disconnected',
    dataSource: 'mock',
    updateFrequency: 0,
    errorCount: 0
  }
};