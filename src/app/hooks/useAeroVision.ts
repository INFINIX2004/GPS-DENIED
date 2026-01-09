import { useState, useEffect, useCallback, useRef } from 'react';
import { AeroVisionData, aeroVisionService } from '../services/aeroVisionService';
import { systemStateManager } from '../services/systemStateManager';
import { SystemState, DEFAULT_SYSTEM_STATE } from '../types/systemState';

// Mock data generator for development/demo (maintained for backward compatibility)
function generateMockAeroVisionData(): AeroVisionData {
  const now = new Date();
  
  return {
    system: {
      power_mode: 'ACTIVE',
      power_w: 8.6 + (Math.random() - 0.5) * 2,
      battery_minutes: Math.max(0, 420 - Math.floor(Math.random() * 10)),
      fps: 24.7 + (Math.random() - 0.5) * 2,
      camera_status: Math.random() > 0.05 ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: now.toLocaleTimeString('en-US', { hour12: false })
    },
    tracks: [
      {
        id: 3,
        zone: Math.random() > 0.7 ? 'CRITICAL' : 'RESTRICTED',
        threat_score: Math.max(0, Math.min(100, 72 + (Math.random() - 0.5) * 20)),
        threat_level: 'HIGH',
        detection_time: Math.floor(18 + Math.random() * 100),
        behavior: {
          loitering: { active: true, duration: Math.floor(96 + Math.random() * 50) },
          speed_anomaly: Math.random() > 0.7,
          trajectory_confidence: 0.84 + (Math.random() - 0.5) * 0.2
        },
        prediction: {
          near: { zone: 'RESTRICTED', confidence: 0.84 + (Math.random() - 0.5) * 0.1 },
          medium: { zone: 'CRITICAL', confidence: 0.71 + (Math.random() - 0.5) * 0.1 },
          far: { zone: 'CRITICAL', confidence: 0.55 + (Math.random() - 0.5) * 0.1 }
        },
        explanation: [
          { factor: 'Zone violation', points: 30 + Math.floor((Math.random() - 0.5) * 10) },
          { factor: 'Loitering detected', points: 15 + Math.floor((Math.random() - 0.5) * 5) },
          { factor: 'Speed anomaly', points: Math.random() > 0.7 ? 10 : 0 }
        ]
      },
      ...(Math.random() > 0.3 ? [{
        id: 7,
        zone: 'BUFFER' as const,
        threat_score: Math.max(0, Math.min(100, 45 + (Math.random() - 0.5) * 15)),
        threat_level: 'MEDIUM' as const,
        detection_time: Math.floor(89 + Math.random() * 50),
        behavior: {
          loitering: { active: Math.random() > 0.5, duration: Math.floor(28 + Math.random() * 30) },
          speed_anomaly: false,
          trajectory_confidence: 0.92 + (Math.random() - 0.5) * 0.1
        },
        prediction: {
          near: { zone: 'BUFFER', confidence: 0.88 + (Math.random() - 0.5) * 0.1 },
          medium: { zone: 'BUFFER', confidence: 0.65 + (Math.random() - 0.5) * 0.1 },
          far: { zone: 'PUBLIC', confidence: 0.42 + (Math.random() - 0.5) * 0.1 }
        },
        explanation: [
          { factor: 'Zone violation', points: 15 + Math.floor((Math.random() - 0.5) * 5) },
          { factor: 'Loitering detected', points: 10 + Math.floor((Math.random() - 0.5) * 3) },
          { factor: 'Predictable trajectory', points: 7 + Math.floor((Math.random() - 0.5) * 3) }
        ]
      }] : [])
    ],
    alerts: [
      { time: '12:03:21', message: 'Entered RESTRICTED zone', level: 'WARNING' },
      { time: '12:02:45', message: 'Loitering behavior detected', level: 'INFO' },
      { time: '12:01:12', message: 'New track detected', level: 'INFO' }
    ]
  };
}

// Transform SystemState to legacy AeroVisionData format for backward compatibility
function transformSystemStateToLegacy(systemState: SystemState): AeroVisionData {
  // Transform system status
  const system = {
    power_mode: systemState.systemStatus.powerMode,
    power_w: systemState.systemStatus.powerConsumption,
    battery_minutes: systemState.systemStatus.batteryRemaining,
    fps: systemState.systemStatus.fps,
    camera_status: systemState.systemStatus.cameraStatus === 'Connected' ? 'CONNECTED' as const : 'DISCONNECTED' as const,
    timestamp: systemState.systemStatus.timestamp
  };

  // Transform tracks
  const tracks = systemState.intruders.map(intruder => {
    const trackId = intruder.trackId.replace('TRK-', '');
    const numericId = parseInt(trackId, 10) || 0;
    
    // Get threat intelligence for this track
    const threatIntel = systemState.threatIntelligence[intruder.trackId];
    
    return {
      id: numericId,
      zone: intruder.zone,
      threat_score: intruder.threatScore,
      threat_level: intruder.threatLevel,
      detection_time: intruder.timeSinceDetection,
      behavior: {
        loitering: {
          active: threatIntel?.behavioral?.loitering || false,
          duration: threatIntel?.behavioral?.loiteringDuration
        },
        speed_anomaly: threatIntel?.behavioral?.speedAnomaly || false,
        trajectory_confidence: (threatIntel?.behavioral?.trajectoryConfidence || 0) / 100
      },
      prediction: {
        near: { 
          zone: extractZoneFromPrediction(threatIntel?.prediction?.nearTerm), 
          confidence: mapConfidenceToNumber(threatIntel?.prediction?.confidence) 
        },
        medium: { 
          zone: extractZoneFromPrediction(threatIntel?.prediction?.mediumTerm), 
          confidence: mapConfidenceToNumber(threatIntel?.prediction?.confidence) * 0.8 
        },
        far: { 
          zone: extractZoneFromPrediction(threatIntel?.prediction?.farTerm), 
          confidence: mapConfidenceToNumber(threatIntel?.prediction?.confidence) * 0.6 
        }
      },
      explanation: threatIntel?.threatBreakdown?.map(breakdown => ({
        factor: breakdown.factor,
        points: breakdown.score
      })) || []
    };
  });

  // Transform alerts
  const alerts = systemState.alerts.recentAlerts.map(alert => ({
    time: new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false }),
    message: alert.message,
    level: alert.type.toUpperCase() as 'INFO' | 'WARNING' | 'CRITICAL'
  }));

  return {
    system,
    tracks,
    alerts
  };
}

// Helper functions for data transformation
function extractZoneFromPrediction(predictionText?: string): string {
  if (!predictionText) return 'UNKNOWN';
  
  const zones = ['CRITICAL', 'RESTRICTED', 'BUFFER', 'PUBLIC'];
  for (const zone of zones) {
    if (predictionText.toUpperCase().includes(zone)) {
      return zone;
    }
  }
  return 'UNKNOWN';
}

function mapConfidenceToNumber(confidence?: string): number {
  switch (confidence?.toLowerCase()) {
    case 'high': return 0.85;
    case 'medium': return 0.65;
    case 'low': return 0.35;
    default: return 0.5;
  }
}

export interface UseAeroVisionOptions {
  useMockData?: boolean;
  mockUpdateInterval?: number;
  useSystemStateManager?: boolean; // New option to use SystemStateManager
}

export function useAeroVision(options: UseAeroVisionOptions = {}) {
  const { 
    useMockData = true, 
    mockUpdateInterval = 200,
    useSystemStateManager: useSSM = true // Default to using SystemStateManager
  } = options;
  
  const [data, setData] = useState<AeroVisionData>(generateMockAeroVisionData());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [systemState, setSystemState] = useState<SystemState>(DEFAULT_SYSTEM_STATE);
  
  // Track subscriptions for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle SystemStateManager integration
  useEffect(() => {
    if (!useSSM) {
      // Fall back to legacy behavior
      return;
    }

    if (useMockData) {
      // Use mock data with SystemStateManager
      setConnectionStatus('connected');
      setError(null);
      
      // Generate mock SystemState data
      const generateMockSystemState = (): SystemState => {
        const mockLegacyData = generateMockAeroVisionData();
        
        return {
          systemStatus: {
            powerMode: mockLegacyData.system.power_mode,
            powerConsumption: mockLegacyData.system.power_w,
            batteryRemaining: mockLegacyData.system.battery_minutes,
            fps: mockLegacyData.system.fps,
            processingStatus: 'Active',
            cameraStatus: mockLegacyData.system.camera_status === 'CONNECTED' ? 'Connected' : 'Lost',
            timestamp: mockLegacyData.system.timestamp
          },
          intruders: mockLegacyData.tracks.map(track => ({
            trackId: `TRK-${track.id.toString().padStart(3, '0')}`,
            zone: track.zone,
            threatScore: Math.round(track.threat_score),
            threatLevel: track.threat_level,
            timeSinceDetection: track.detection_time
          })),
          threatIntelligence: mockLegacyData.tracks.reduce((intel, track) => {
            const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
            intel[trackId] = {
              threatBreakdown: track.explanation.map(exp => ({
                factor: exp.factor,
                score: exp.points
              })),
              behavioral: {
                loitering: track.behavior.loitering.active,
                loiteringDuration: track.behavior.loitering.duration,
                speedAnomaly: track.behavior.speed_anomaly,
                trajectoryStability: 'Stable' as const,
                trajectoryConfidence: Math.round(track.behavior.trajectory_confidence * 100)
              },
              prediction: {
                nearTerm: `Moving toward ${track.prediction.near.zone}`,
                mediumTerm: `Expected in ${track.prediction.medium.zone}`,
                farTerm: `Long-term: ${track.prediction.far.zone}`,
                confidence: track.prediction.near.confidence > 0.8 ? 'High' as const : 
                          track.prediction.near.confidence > 0.5 ? 'Medium' as const : 'Low' as const,
                willEnterRestricted: track.prediction.near.zone === 'RESTRICTED' || track.prediction.near.zone === 'CRITICAL'
              }
            };
            return intel;
          }, {} as Record<string, any>),
          alerts: {
            alertLevel: mockLegacyData.tracks.some(t => t.threat_level === 'CRITICAL') ? 'CRITICAL' as const :
                      mockLegacyData.tracks.some(t => t.threat_level === 'HIGH') ? 'HIGH' as const :
                      mockLegacyData.tracks.length > 0 ? 'ELEVATED' as const : 'NORMAL' as const,
            recommendation: mockLegacyData.tracks.length > 0 ? 
              `${mockLegacyData.tracks.length} track${mockLegacyData.tracks.length > 1 ? 's' : ''} under surveillance` :
              'All clear - no active threats detected',
            recentAlerts: mockLegacyData.alerts.map((alert, index) => ({
              id: `alert-${index}`,
              timestamp: new Date().toISOString(),
              message: alert.message,
              type: alert.level.toLowerCase() as 'info' | 'warning' | 'critical'
            }))
          },
          videoStatus: {
            isLive: false,
            resolution: '1920x1080',
            latency: 50,
            source: 'webcam' as const
          },
          metadata: {
            lastUpdated: new Date().toISOString(),
            connectionStatus: 'connected',
            dataSource: 'mock',
            updateFrequency: 1000 / mockUpdateInterval
          }
        };
      };

      // Update SystemStateManager with mock data
      const updateMockData = () => {
        const mockState = generateMockSystemState();
        systemStateManager.updateState(mockState);
      };

      // Initial update
      updateMockData();

      // Set up interval for mock updates
      mockIntervalRef.current = setInterval(updateMockData, mockUpdateInterval);

      // Subscribe to SystemStateManager updates
      unsubscribeRef.current = systemStateManager.subscribe((newState: SystemState) => {
        setSystemState(newState);
        setData(transformSystemStateToLegacy(newState));
        setConnectionStatus(newState.metadata.connectionStatus);
        setError(null);
      });

      return () => {
        if (mockIntervalRef.current) {
          clearInterval(mockIntervalRef.current);
          mockIntervalRef.current = null;
        }
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } else {
      // Use real AeroVision service with SystemStateManager
      setConnectionStatus('connecting');
      setError(null);
      
      // Subscribe to SystemStateManager updates (which receives data from BackendService)
      unsubscribeRef.current = systemStateManager.subscribe((newState: SystemState) => {
        setSystemState(newState);
        setData(transformSystemStateToLegacy(newState));
        setConnectionStatus(newState.metadata.connectionStatus);
        
        // Handle errors from metadata
        if (newState.metadata.errorCount && newState.metadata.errorCount > 0) {
          setError(`Connection issues detected (${newState.metadata.errorCount} errors)`);
        } else {
          setError(null);
        }
      });

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }
  }, [useMockData, mockUpdateInterval, useSSM]);

  // Legacy behavior when not using SystemStateManager
  useEffect(() => {
    if (useSSM) {
      // Skip legacy behavior when using SystemStateManager
      return;
    }

    if (useMockData) {
      // Use mock data with simulated updates (legacy behavior)
      setConnectionStatus('connected');
      
      const interval = setInterval(() => {
        setData(generateMockAeroVisionData());
      }, mockUpdateInterval);

      return () => clearInterval(interval);
    } else {
      // Use real AeroVision service (legacy behavior)
      setConnectionStatus('connecting');
      
      const unsubscribe = aeroVisionService.subscribe((newData) => {
        setData(newData);
        setError(null);
      });

      // Monitor connection status
      const statusInterval = setInterval(() => {
        setConnectionStatus(aeroVisionService.getConnectionStatus());
      }, 1000);

      return () => {
        unsubscribe();
        clearInterval(statusInterval);
      };
    }
  }, [useMockData, mockUpdateInterval, useSSM]);

  // Manual refresh function with SystemStateManager support
  const refresh = useCallback(async () => {
    try {
      if (useSSM && !useMockData) {
        // Refresh through SystemStateManager (which uses BackendService)
        const currentState = systemStateManager.getCurrentState();
        if (currentState.metadata.connectionStatus === 'connected') {
          // Force a refresh by getting fresh data from backend
          const refreshedData = await aeroVisionService.refresh();
          if (refreshedData) {
            setData(refreshedData);
            setError(null);
          }
        } else {
          setError('Cannot refresh: not connected to backend');
        }
      } else if (useSSM && useMockData) {
        // Generate new mock data and update SystemStateManager
        const mockState = {
          systemStatus: {
            powerMode: 'ACTIVE' as const,
            powerConsumption: 8.6 + (Math.random() - 0.5) * 2,
            batteryRemaining: Math.max(0, 420 - Math.floor(Math.random() * 10)),
            fps: 24.7 + (Math.random() - 0.5) * 2,
            processingStatus: 'Active',
            cameraStatus: Math.random() > 0.05 ? 'Connected' as const : 'Lost' as const,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
          }
        };
        systemStateManager.updateSystemStatus(mockState.systemStatus);
      } else if (useMockData) {
        // Legacy mock refresh
        setData(generateMockAeroVisionData());
      } else {
        // Legacy real service refresh
        const newData = await aeroVisionService.refresh();
        if (newData) {
          setData(newData);
          setError(null);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data';
      setError(errorMessage);
      console.error('[useAeroVision] Refresh failed:', err);
    }
  }, [useMockData, useSSM]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
      }
    };
  }, []);

  return {
    data,
    connectionStatus,
    error,
    refresh,
    isConnected: connectionStatus === 'connected',
    isLoading: connectionStatus === 'connecting',
    // Additional properties for SystemStateManager integration
    systemState: useSSM ? systemState : null,
    usingSystemStateManager: useSSM
  };
}