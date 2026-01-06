import { useState, useEffect, useCallback } from 'react';
import { AeroVisionData, aeroVisionService } from '../services/aeroVisionService';

// Mock data generator for development/demo
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

export interface UseAeroVisionOptions {
  useMockData?: boolean;
  mockUpdateInterval?: number;
}

export function useAeroVision(options: UseAeroVisionOptions = {}) {
  const { useMockData = true, mockUpdateInterval = 200 } = options;
  
  const [data, setData] = useState<AeroVisionData>(generateMockAeroVisionData());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Handle real AeroVision data
  useEffect(() => {
    if (useMockData) {
      // Use mock data with simulated updates
      setConnectionStatus('connected');
      
      const interval = setInterval(() => {
        setData(generateMockAeroVisionData());
      }, mockUpdateInterval);

      return () => clearInterval(interval);
    } else {
      // Use real AeroVision service
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
  }, [useMockData, mockUpdateInterval]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (useMockData) {
      setData(generateMockAeroVisionData());
    } else {
      try {
        const newData = await aeroVisionService.refresh();
        if (newData) {
          setData(newData);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh data');
      }
    }
  }, [useMockData]);

  return {
    data,
    connectionStatus,
    error,
    refresh,
    isConnected: connectionStatus === 'connected',
    isLoading: connectionStatus === 'connecting'
  };
}