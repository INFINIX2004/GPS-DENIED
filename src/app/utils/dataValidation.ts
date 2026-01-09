import { 
  SystemState, 
  SystemStatusData, 
  IntruderData, 
  ThreatIntelligenceData,
  AlertsData,
  VideoStatusData,
  DEFAULT_SYSTEM_STATE 
} from '../types/systemState';

/**
 * Data validation utilities for graceful handling of missing or invalid data
 * Provides safe defaults and validation functions
 * 
 * Requirements: 6.1, 6.2, 6.3 - Graceful handling of missing/invalid data
 */

/**
 * Validates and sanitizes SystemStatusData
 */
export function validateSystemStatus(data: any): SystemStatusData {
  if (!data || typeof data !== 'object') {
    return DEFAULT_SYSTEM_STATE.systemStatus;
  }

  return {
    powerMode: ['IDLE', 'ACTIVE', 'ALERT'].includes(data.powerMode) ? data.powerMode : 'IDLE',
    powerConsumption: typeof data.powerConsumption === 'number' && data.powerConsumption >= 0 
      ? data.powerConsumption : 0,
    batteryRemaining: typeof data.batteryRemaining === 'number' && data.batteryRemaining >= 0 
      ? data.batteryRemaining : 0,
    fps: typeof data.fps === 'number' && data.fps >= 0 ? data.fps : 0,
    processingStatus: typeof data.processingStatus === 'string' ? data.processingStatus : 'Offline',
    cameraStatus: ['Connected', 'Lost'].includes(data.cameraStatus) ? data.cameraStatus : 'Lost',
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : 
      new Date().toLocaleTimeString('en-US', { hour12: false })
  };
}

/**
 * Validates and sanitizes IntruderData array
 */
export function validateIntruders(data: any): IntruderData[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(item => item && typeof item === 'object')
    .map(intruder => validateIntruder(intruder))
    .filter(intruder => intruder !== null) as IntruderData[];
}

/**
 * Validates and sanitizes individual IntruderData
 */
export function validateIntruder(data: any): IntruderData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Require essential fields
  if (!data.trackId || typeof data.trackId !== 'string') {
    return null;
  }

  return {
    trackId: data.trackId,
    zone: ['PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'].includes(data.zone) 
      ? data.zone : 'PUBLIC',
    threatScore: typeof data.threatScore === 'number' && data.threatScore >= 0 && data.threatScore <= 100
      ? Math.round(data.threatScore) : 0,
    threatLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(data.threatLevel)
      ? data.threatLevel : 'LOW',
    timeSinceDetection: typeof data.timeSinceDetection === 'number' && data.timeSinceDetection >= 0
      ? Math.round(data.timeSinceDetection) : 0
  };
}

/**
 * Validates and sanitizes ThreatIntelligence data
 */
export function validateThreatIntelligence(data: any): Record<string, ThreatIntelligenceData> {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const validated: Record<string, ThreatIntelligenceData> = {};

  for (const [trackId, intelligence] of Object.entries(data)) {
    if (typeof trackId === 'string' && intelligence && typeof intelligence === 'object') {
      const validatedIntelligence = validateSingleThreatIntelligence(intelligence);
      if (validatedIntelligence) {
        validated[trackId] = validatedIntelligence;
      }
    }
  }

  return validated;
}

/**
 * Validates and sanitizes individual ThreatIntelligenceData
 */
export function validateSingleThreatIntelligence(data: any): ThreatIntelligenceData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Validate threat breakdown
  const threatBreakdown = Array.isArray(data.threatBreakdown) 
    ? data.threatBreakdown
        .filter(item => item && typeof item === 'object' && 
                       typeof item.factor === 'string' && 
                       typeof item.score === 'number')
        .map(item => ({
          factor: item.factor,
          score: Math.round(item.score)
        }))
    : [];

  // Validate behavioral analysis
  const behavioral = data.behavioral && typeof data.behavioral === 'object' ? {
    loitering: Boolean(data.behavioral.loitering),
    loiteringDuration: typeof data.behavioral.loiteringDuration === 'number' && data.behavioral.loiteringDuration > 0
      ? Math.round(data.behavioral.loiteringDuration) : undefined,
    speedAnomaly: Boolean(data.behavioral.speedAnomaly),
    trajectoryStability: ['Stable', 'Moderate', 'Erratic'].includes(data.behavioral.trajectoryStability)
      ? data.behavioral.trajectoryStability : 'Stable',
    trajectoryConfidence: typeof data.behavioral.trajectoryConfidence === 'number' && 
                         data.behavioral.trajectoryConfidence >= 0 && 
                         data.behavioral.trajectoryConfidence <= 100
      ? Math.round(data.behavioral.trajectoryConfidence) : 0
  } : {
    loitering: false,
    speedAnomaly: false,
    trajectoryStability: 'Stable' as const,
    trajectoryConfidence: 0
  };

  // Validate prediction analysis
  const prediction = data.prediction && typeof data.prediction === 'object' ? {
    nearTerm: typeof data.prediction.nearTerm === 'string' ? data.prediction.nearTerm : 'Unknown',
    mediumTerm: typeof data.prediction.mediumTerm === 'string' ? data.prediction.mediumTerm : 'Unknown',
    farTerm: typeof data.prediction.farTerm === 'string' ? data.prediction.farTerm : 'Unknown',
    confidence: ['High', 'Medium', 'Low'].includes(data.prediction.confidence)
      ? data.prediction.confidence : 'Low',
    willEnterRestricted: Boolean(data.prediction.willEnterRestricted)
  } : {
    nearTerm: 'No prediction available',
    mediumTerm: 'No prediction available',
    farTerm: 'No prediction available',
    confidence: 'Low' as const,
    willEnterRestricted: false
  };

  return {
    threatBreakdown,
    behavioral,
    prediction
  };
}

/**
 * Validates and sanitizes AlertsData
 */
export function validateAlerts(data: any): AlertsData {
  if (!data || typeof data !== 'object') {
    return DEFAULT_SYSTEM_STATE.alerts;
  }

  const recentAlerts = Array.isArray(data.recentAlerts)
    ? data.recentAlerts
        .filter(alert => alert && typeof alert === 'object' &&
                        typeof alert.id === 'string' &&
                        typeof alert.timestamp === 'string' &&
                        typeof alert.message === 'string' &&
                        ['info', 'warning', 'critical'].includes(alert.type))
        .map(alert => ({
          id: alert.id,
          timestamp: alert.timestamp,
          message: alert.message,
          type: alert.type
        }))
        .slice(0, 10) // Limit to 10 most recent alerts
    : [];

  return {
    alertLevel: ['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL'].includes(data.alertLevel)
      ? data.alertLevel : 'NORMAL',
    recommendation: typeof data.recommendation === 'string' 
      ? data.recommendation : 'No recommendations available',
    recentAlerts
  };
}

/**
 * Validates and sanitizes VideoStatusData
 */
export function validateVideoStatus(data: any): VideoStatusData {
  if (!data || typeof data !== 'object') {
    return DEFAULT_SYSTEM_STATE.videoStatus;
  }

  return {
    isLive: Boolean(data.isLive),
    resolution: typeof data.resolution === 'string' ? data.resolution : '0x0',
    latency: typeof data.latency === 'number' && data.latency >= 0 ? Math.round(data.latency) : 0,
    source: ['webcam', 'drone', 'placeholder'].includes(data.source) ? data.source : 'placeholder',
    streamUrl: typeof data.streamUrl === 'string' ? data.streamUrl : undefined,
    frameRate: typeof data.frameRate === 'number' && data.frameRate > 0 ? Math.round(data.frameRate) : undefined,
    bitrate: typeof data.bitrate === 'number' && data.bitrate > 0 ? Math.round(data.bitrate) : undefined
  };
}

/**
 * Validates and sanitizes complete SystemState
 */
export function validateSystemState(data: any): SystemState {
  if (!data || typeof data !== 'object') {
    return DEFAULT_SYSTEM_STATE;
  }

  return {
    systemStatus: validateSystemStatus(data.systemStatus),
    intruders: validateIntruders(data.intruders),
    threatIntelligence: validateThreatIntelligence(data.threatIntelligence),
    alerts: validateAlerts(data.alerts),
    videoStatus: validateVideoStatus(data.videoStatus),
    metadata: {
      lastUpdated: typeof data.metadata?.lastUpdated === 'string' 
        ? data.metadata.lastUpdated : new Date().toISOString(),
      connectionStatus: ['connected', 'connecting', 'disconnected'].includes(data.metadata?.connectionStatus)
        ? data.metadata.connectionStatus : 'disconnected',
      dataSource: ['websocket', 'rest', 'mock'].includes(data.metadata?.dataSource)
        ? data.metadata.dataSource : 'mock',
      updateFrequency: typeof data.metadata?.updateFrequency === 'number' && data.metadata.updateFrequency >= 0
        ? data.metadata.updateFrequency : 0,
      errorCount: typeof data.metadata?.errorCount === 'number' && data.metadata.errorCount >= 0
        ? data.metadata.errorCount : 0
    }
  };
}

/**
 * Checks if data is considered "empty" or "no data" state
 */
export function isEmptyState(systemState: SystemState): {
  hasIntruders: boolean;
  hasAlerts: boolean;
  isSystemOnline: boolean;
  isCameraOnline: boolean;
  isVideoLive: boolean;
} {
  return {
    hasIntruders: systemState.intruders.length > 0,
    hasAlerts: systemState.alerts.recentAlerts.length > 0,
    isSystemOnline: systemState.metadata.connectionStatus === 'connected',
    isCameraOnline: systemState.systemStatus.cameraStatus === 'Connected',
    isVideoLive: systemState.videoStatus.isLive
  };
}

/**
 * Gets appropriate fallback reason based on system state
 */
export function getFallbackReason(systemState: SystemState, componentType: string): string {
  const state = isEmptyState(systemState);

  switch (componentType) {
    case 'intruders':
      if (!state.isSystemOnline) return 'offline';
      if (!state.isCameraOnline) return 'offline';
      if (!state.hasIntruders) return 'no-data';
      return 'error';

    case 'threat-intelligence':
      if (!state.isSystemOnline) return 'offline';
      if (!state.hasIntruders) return 'no-selection';
      return 'no-data';

    case 'video':
      if (!state.isCameraOnline) return 'no-camera';
      if (!state.isVideoLive) return 'offline';
      return 'error';

    case 'alerts':
      if (!state.isSystemOnline) return 'offline';
      return 'no-data';

    default:
      return state.isSystemOnline ? 'error' : 'offline';
  }
}

/**
 * Safe property access with fallback
 */
export function safeGet<T>(obj: any, path: string, fallback: T): T {
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return fallback;
      }
      current = current[key];
    }
    
    return current !== undefined ? current : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Validates array and ensures it's not empty
 */
export function validateArray<T>(data: any, validator?: (item: any) => T | null): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  if (!validator) {
    return data.filter(item => item !== null && item !== undefined);
  }

  return data
    .map(validator)
    .filter((item): item is T => item !== null);
}