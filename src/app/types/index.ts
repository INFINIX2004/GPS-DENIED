// Type Exports
// Central export file for all TypeScript interfaces and types

// System State Types
export type {
  SystemState,
  SystemMetadata,
  SystemStatusData,
  IntruderData,
  ThreatIntelligenceData,
  ThreatBreakdownItem,
  BehavioralAnalysis,
  PredictionAnalysis,
  AlertsData,
  AlertItem,
  VideoStatusData,
  ConnectionStatus,
  DataSource,
  UpdateFrequencyConfig
} from './systemState';

export { DEFAULT_SYSTEM_STATE } from './systemState';

// Python Interface Types
export type {
  PythonSystemData,
  PythonSystemStatus,
  PythonTrack,
  PythonBehaviorData,
  PythonPredictionData,
  PythonPredictionItem,
  PythonExplanationItem,
  PythonAlert,
  PythonVideoStatus,
  PythonZoneStatus,
  PythonPowerMetrics,
  PythonWebSocketMessage,
  PythonApiResponse,
  PythonConfigResponse
} from './pythonInterfaces';

export {
  isPythonSystemData,
  isPythonTrack,
  isPythonWebSocketMessage
} from './pythonInterfaces';

// Service Interface Types
export type {
  BackendService,
  BackendServiceOptions,
  DataTransformer,
  SystemStateManager,
  WebSocketHandler,
  RestApiHandler,
  ConnectionManager,
  PerformanceMonitor,
  MemoryUsage,
  PerformanceReport,
  ErrorHandler,
  ErrorRecord,
  ServiceFactory,
  ServiceConfiguration
} from './serviceInterfaces';

// Legacy compatibility exports (for existing components)
// These maintain backward compatibility with existing component interfaces

/**
 * @deprecated Use IntruderData instead
 */
export type Intruder = IntruderData;

/**
 * @deprecated Use AlertItem instead
 */
export type Alert = AlertItem;

/**
 * Legacy AeroVision data structure for backward compatibility
 * @deprecated Use SystemState instead
 */
export interface AeroVisionData {
  system: {
    power_mode: 'IDLE' | 'ACTIVE' | 'ALERT';
    power_w: number;
    battery_minutes: number;
    fps: number;
    camera_status: 'CONNECTED' | 'DISCONNECTED';
    timestamp: string;
  };
  tracks: Array<{
    id: number;
    zone: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
    threat_score: number;
    threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    detection_time: number;
    behavior: {
      loitering: { active: boolean; duration?: number };
      speed_anomaly: boolean;
      trajectory_confidence: number;
    };
    prediction: {
      near: { zone: string; confidence: number };
      medium: { zone: string; confidence: number };
      far: { zone: string; confidence: number };
    };
    explanation: Array<{ factor: string; points: number }>;
  }>;
  alerts: Array<{
    time: string;
    message: string;
    level: 'INFO' | 'WARNING' | 'CRITICAL';
  }>;
}

// Re-export from existing service for compatibility
export type { AeroVisionData as LegacyAeroVisionData } from '../services/aeroVisionService';

// System State Manager exports
export { SystemStateManager, systemStateManager } from '../services/systemStateManager';
export type { SystemStateManagerOptions } from '../services/systemStateManager';

// Utility types for type safety
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Type guards for runtime type checking
export function isSystemState(data: any): data is SystemState {
  if (data === null || data === undefined || typeof data !== 'object') {
    return false;
  }
  
  return !!(
    data.systemStatus &&
    typeof data.systemStatus === 'object' &&
    Array.isArray(data.intruders) &&
    data.threatIntelligence &&
    typeof data.threatIntelligence === 'object' &&
    data.alerts &&
    typeof data.alerts === 'object' &&
    data.videoStatus &&
    typeof data.videoStatus === 'object' &&
    data.metadata &&
    typeof data.metadata === 'object'
  );
}

export function isIntruderData(data: any): data is IntruderData {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.trackId === 'string' &&
    typeof data.zone === 'string' &&
    typeof data.threatScore === 'number' &&
    typeof data.threatLevel === 'string' &&
    typeof data.timeSinceDetection === 'number'
  );
}

export function isSystemStatusData(data: any): data is SystemStatusData {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.powerMode === 'string' &&
    typeof data.powerConsumption === 'number' &&
    typeof data.batteryRemaining === 'number' &&
    typeof data.fps === 'number' &&
    typeof data.processingStatus === 'string' &&
    typeof data.cameraStatus === 'string' &&
    typeof data.timestamp === 'string'
  );
}