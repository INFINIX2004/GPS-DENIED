// React Hook for System State Management
// Provides React components with centralized state management via SystemStateManager
// Implements performance optimizations and selective subscriptions

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SystemState, SystemStatusData, IntruderData, ThreatIntelligenceData, AlertsData, VideoStatusData } from '../types/systemState';
import { systemStateManager } from '../services/systemStateManager';

/**
 * Options for useSystemState hook
 */
export interface UseSystemStateOptions {
  // Selective subscriptions for performance
  subscribeToSystemStatus?: boolean;
  subscribeToIntruders?: boolean;
  subscribeToThreatIntelligence?: boolean;
  subscribeToAlerts?: boolean;
  subscribeToVideoStatus?: boolean;
  subscribeToMetadata?: boolean;
  
  // Performance options
  enableDeepComparison?: boolean;
  updateThrottleMs?: number;
}

/**
 * Return type for useSystemState hook
 */
export interface UseSystemStateReturn {
  // Current state
  state: SystemState;
  
  // Individual state sections
  systemStatus: SystemStatusData;
  intruders: IntruderData[];
  threatIntelligence: Record<string, ThreatIntelligenceData>;
  alerts: AlertsData;
  videoStatus: VideoStatusData;
  
  // State update functions
  updateSystemStatus: (status: SystemStatusData) => void;
  updateIntruders: (intruders: IntruderData[]) => void;
  updateThreatIntelligence: (trackId: string, data: ThreatIntelligenceData) => void;
  updateAlerts: (alerts: AlertsData) => void;
  updateVideoStatus: (status: VideoStatusData) => void;
  updateState: (newState: Partial<SystemState>) => void;
  
  // Utility functions
  reset: () => void;
  getHistory: (count?: number) => SystemState[];
  
  // Performance metrics
  performanceMetrics: {
    subscriberCount: number;
    historySize: number;
    memoryUsage: number;
    averageUpdateLatency: number;
  };
}

/**
 * React hook for system state management
 * Provides centralized state with performance optimizations
 */
export function useSystemState(options: UseSystemStateOptions = {}): UseSystemStateReturn {
  const {
    subscribeToSystemStatus = true,
    subscribeToIntruders = true,
    subscribeToThreatIntelligence = true,
    subscribeToAlerts = true,
    subscribeToVideoStatus = true,
    subscribeToMetadata = true,
    enableDeepComparison = false,
    updateThrottleMs = 0
  } = options;

  // State management
  const [state, setState] = useState<SystemState>(() => systemStateManager.getCurrentState());
  const [performanceMetrics, setPerformanceMetrics] = useState(() => systemStateManager.getPerformanceMetrics());
  
  // Refs for performance optimization
  const lastUpdateTime = useRef<number>(0);
  const throttleTimeout = useRef<NodeJS.Timeout | null>(null);
  const previousState = useRef<SystemState>(state);

  // Throttled state update function
  const updateStateThrottled = useCallback((newState: SystemState) => {
    const now = Date.now();
    
    if (updateThrottleMs === 0) {
      // No throttling
      setState(newState);
      previousState.current = newState;
      lastUpdateTime.current = now;
      return;
    }

    if (now - lastUpdateTime.current >= updateThrottleMs) {
      // Enough time has passed, update immediately
      setState(newState);
      previousState.current = newState;
      lastUpdateTime.current = now;
    } else {
      // Throttle the update
      if (throttleTimeout.current) {
        clearTimeout(throttleTimeout.current);
      }
      
      throttleTimeout.current = setTimeout(() => {
        setState(newState);
        previousState.current = newState;
        lastUpdateTime.current = Date.now();
        throttleTimeout.current = null;
      }, updateThrottleMs - (now - lastUpdateTime.current));
    }
  }, [updateThrottleMs]);

  // State change handler with selective updates
  const handleStateChange = useCallback((newState: SystemState) => {
    // Check if we should update based on subscriptions
    let shouldUpdate = false;
    
    if (enableDeepComparison) {
      // Deep comparison for selective updates
      if (subscribeToSystemStatus && !deepEqual(previousState.current.systemStatus, newState.systemStatus)) {
        shouldUpdate = true;
      }
      if (subscribeToIntruders && !deepEqual(previousState.current.intruders, newState.intruders)) {
        shouldUpdate = true;
      }
      if (subscribeToThreatIntelligence && !deepEqual(previousState.current.threatIntelligence, newState.threatIntelligence)) {
        shouldUpdate = true;
      }
      if (subscribeToAlerts && !deepEqual(previousState.current.alerts, newState.alerts)) {
        shouldUpdate = true;
      }
      if (subscribeToVideoStatus && !deepEqual(previousState.current.videoStatus, newState.videoStatus)) {
        shouldUpdate = true;
      }
      if (subscribeToMetadata && !deepEqual(previousState.current.metadata, newState.metadata)) {
        shouldUpdate = true;
      }
    } else {
      // Simple reference comparison (faster but less precise)
      shouldUpdate = true; // Always update for simplicity unless deep comparison is enabled
    }

    if (shouldUpdate) {
      updateStateThrottled(newState);
    }
  }, [
    subscribeToSystemStatus,
    subscribeToIntruders, 
    subscribeToThreatIntelligence,
    subscribeToAlerts,
    subscribeToVideoStatus,
    subscribeToMetadata,
    enableDeepComparison,
    updateStateThrottled
  ]);

  // Subscribe to state manager
  useEffect(() => {
    const unsubscribe = systemStateManager.subscribe(handleStateChange);
    
    // Update performance metrics periodically
    const metricsInterval = setInterval(() => {
      setPerformanceMetrics(systemStateManager.getPerformanceMetrics());
    }, 5000); // Update every 5 seconds

    return () => {
      unsubscribe();
      clearInterval(metricsInterval);
      
      if (throttleTimeout.current) {
        clearTimeout(throttleTimeout.current);
      }
    };
  }, [handleStateChange]);

  // Update functions
  const updateSystemStatus = useCallback((status: SystemStatusData) => {
    systemStateManager.updateSystemStatus(status);
  }, []);

  const updateIntruders = useCallback((intruders: IntruderData[]) => {
    systemStateManager.updateIntruders(intruders);
  }, []);

  const updateThreatIntelligence = useCallback((trackId: string, data: ThreatIntelligenceData) => {
    systemStateManager.updateThreatIntelligence(trackId, data);
  }, []);

  const updateAlerts = useCallback((alerts: AlertsData) => {
    systemStateManager.updateAlerts(alerts);
  }, []);

  const updateVideoStatus = useCallback((status: VideoStatusData) => {
    systemStateManager.updateVideoStatus(status);
  }, []);

  const updateState = useCallback((newState: Partial<SystemState>) => {
    systemStateManager.updateState(newState);
  }, []);

  const reset = useCallback(() => {
    systemStateManager.reset();
  }, []);

  const getHistory = useCallback((count?: number) => {
    return systemStateManager.getStateHistory(count);
  }, []);

  // Memoized individual state sections for performance
  const systemStatus = useMemo(() => state.systemStatus, [state.systemStatus]);
  const intruders = useMemo(() => state.intruders, [state.intruders]);
  const threatIntelligence = useMemo(() => state.threatIntelligence, [state.threatIntelligence]);
  const alerts = useMemo(() => state.alerts, [state.alerts]);
  const videoStatus = useMemo(() => state.videoStatus, [state.videoStatus]);

  return {
    state,
    systemStatus,
    intruders,
    threatIntelligence,
    alerts,
    videoStatus,
    updateSystemStatus,
    updateIntruders,
    updateThreatIntelligence,
    updateAlerts,
    updateVideoStatus,
    updateState,
    reset,
    getHistory,
    performanceMetrics
  };
}

/**
 * Hook for accessing only system status data
 * Performance optimized for components that only need system status
 */
export function useSystemStatus(): {
  systemStatus: SystemStatusData;
  updateSystemStatus: (status: SystemStatusData) => void;
} {
  const { systemStatus, updateSystemStatus } = useSystemState({
    subscribeToSystemStatus: true,
    subscribeToIntruders: false,
    subscribeToThreatIntelligence: false,
    subscribeToAlerts: false,
    subscribeToVideoStatus: false,
    subscribeToMetadata: false,
    enableDeepComparison: true
  });

  return { systemStatus, updateSystemStatus };
}

/**
 * Hook for accessing only intruders data
 * Performance optimized for components that only need intruder information
 */
export function useIntruders(): {
  intruders: IntruderData[];
  updateIntruders: (intruders: IntruderData[]) => void;
} {
  const { intruders, updateIntruders } = useSystemState({
    subscribeToSystemStatus: false,
    subscribeToIntruders: true,
    subscribeToThreatIntelligence: false,
    subscribeToAlerts: false,
    subscribeToVideoStatus: false,
    subscribeToMetadata: false,
    enableDeepComparison: true
  });

  return { intruders, updateIntruders };
}

/**
 * Hook for accessing only threat intelligence data
 * Performance optimized for components that only need threat analysis
 */
export function useThreatIntelligence(): {
  threatIntelligence: Record<string, ThreatIntelligenceData>;
  updateThreatIntelligence: (trackId: string, data: ThreatIntelligenceData) => void;
} {
  const { threatIntelligence, updateThreatIntelligence } = useSystemState({
    subscribeToSystemStatus: false,
    subscribeToIntruders: false,
    subscribeToThreatIntelligence: true,
    subscribeToAlerts: false,
    subscribeToVideoStatus: false,
    subscribeToMetadata: false,
    enableDeepComparison: true
  });

  return { threatIntelligence, updateThreatIntelligence };
}

/**
 * Hook for accessing only alerts data
 * Performance optimized for components that only need alert information
 */
export function useAlerts(): {
  alerts: AlertsData;
  updateAlerts: (alerts: AlertsData) => void;
} {
  const { alerts, updateAlerts } = useSystemState({
    subscribeToSystemStatus: false,
    subscribeToIntruders: false,
    subscribeToThreatIntelligence: false,
    subscribeToAlerts: true,
    subscribeToVideoStatus: false,
    subscribeToMetadata: false,
    enableDeepComparison: true
  });

  return { alerts, updateAlerts };
}

/**
 * Hook for accessing only video status data
 * Performance optimized for components that only need video information
 */
export function useVideoStatus(): {
  videoStatus: VideoStatusData;
  updateVideoStatus: (status: VideoStatusData) => void;
} {
  const { videoStatus, updateVideoStatus } = useSystemState({
    subscribeToSystemStatus: false,
    subscribeToIntruders: false,
    subscribeToThreatIntelligence: false,
    subscribeToAlerts: false,
    subscribeToVideoStatus: true,
    subscribeToMetadata: false,
    enableDeepComparison: true
  });

  return { videoStatus, updateVideoStatus };
}

/**
 * Deep equality comparison utility
 */
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true;
  }

  if (obj1 == null || obj2 == null) {
    return obj1 === obj2;
  }

  if (typeof obj1 !== typeof obj2) {
    return false;
  }

  if (typeof obj1 !== 'object') {
    return obj1 === obj2;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) {
    return false;
  }

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) {
      return false;
    }
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) {
        return false;
      }
    }
    return true;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (!keys2.includes(key)) {
      return false;
    }
    if (!deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}