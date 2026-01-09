// AeroVision Data Service
// Handles real-time data from AeroVision system via API/WebSocket
// Updated to use new Backend Service with data transformation layer

import { AeroVisionBackendService } from './backendService';
import { SystemState } from '../types/systemState';

// Legacy interfaces maintained for backward compatibility
export interface AeroVisionSystemData {
  power_mode: 'IDLE' | 'ACTIVE' | 'ALERT';
  power_w: number;
  battery_minutes: number;
  fps: number;
  camera_status: 'CONNECTED' | 'DISCONNECTED';
  timestamp: string;
}

export interface AeroVisionTrack {
  id: number;
  zone: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
  threat_score: number;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detection_time: number;
  behavior: {
    loitering: {
      active: boolean;
      duration?: number;
    };
    speed_anomaly: boolean;
    trajectory_confidence: number;
  };
  prediction: {
    near: { zone: string; confidence: number };
    medium: { zone: string; confidence: number };
    far: { zone: string; confidence: number };
  };
  explanation: Array<{
    factor: string;
    points: number;
  }>;
}

export interface AeroVisionAlert {
  time: string;
  message: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AeroVisionData {
  system: AeroVisionSystemData;
  tracks: AeroVisionTrack[];
  alerts: AeroVisionAlert[];
}

export class AeroVisionService {
  private backendService: AeroVisionBackendService;
  private listeners: Array<(data: AeroVisionData) => void> = [];
  private unsubscribeFromBackend: (() => void) | null = null;
  private currentLegacyData: AeroVisionData | null = null;

  constructor(private wsUrl?: string, private apiUrl?: string) {
    // Initialize new backend service with provided URLs
    this.backendService = new AeroVisionBackendService({
      websocketUrl: wsUrl || 'ws://localhost:8080/aerovision/stream',
      apiUrl: apiUrl || 'http://localhost:8080/aerovision/data',
      preferWebSocket: true,
      updateFrequency: 5, // 5 Hz as per requirements
      enableLogging: process.env.NODE_ENV === 'development'
    });

    console.log('[AeroVisionService] Initialized with new Backend Service integration');
  }

  // Subscribe to real-time data updates (maintains backward compatibility)
  subscribe(callback: (data: AeroVisionData) => void): () => void {
    this.listeners.push(callback);
    console.log(`[AeroVisionService] Subscriber added. Total: ${this.listeners.length}`);
    
    // Start backend connection if this is the first subscriber
    if (this.listeners.length === 1) {
      this.startBackendSubscription();
    }

    // Send current data to new subscriber if available
    if (this.currentLegacyData) {
      try {
        callback(this.currentLegacyData);
      } catch (error) {
        console.error('[AeroVisionService] Error in subscriber callback:', error);
      }
    }

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
      console.log(`[AeroVisionService] Subscriber removed. Total: ${this.listeners.length}`);
      
      // Stop backend subscription if no more listeners
      if (this.listeners.length === 0) {
        this.stopBackendSubscription();
      }
    };
  }

  // Get connection status (maintains backward compatibility)
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.backendService.getConnectionStatus();
  }

  // Manual data refresh (maintains backward compatibility)
  async refresh(): Promise<AeroVisionData | null> {
    try {
      const systemState = await this.backendService.refresh();
      if (systemState) {
        const legacyData = this.transformSystemStateToLegacy(systemState);
        this.currentLegacyData = legacyData;
        
        // Manually notify listeners since manual refresh doesn't trigger backend subscription
        this.notifyListeners(legacyData);
        
        return legacyData;
      }
      return null;
    } catch (error) {
      console.error('[AeroVisionService] Failed to refresh data:', error);
      return null;
    }
  }

  // Start subscription to backend service
  private startBackendSubscription(): void {
    console.log('[AeroVisionService] Starting backend subscription');
    
    this.unsubscribeFromBackend = this.backendService.subscribe((systemState: SystemState) => {
      try {
        // Transform SystemState to legacy AeroVisionData format
        const legacyData = this.transformSystemStateToLegacy(systemState);
        this.currentLegacyData = legacyData;
        
        // Notify all legacy listeners
        this.notifyListeners(legacyData);
      } catch (error) {
        console.error('[AeroVisionService] Error transforming system state:', error);
      }
    });
  }

  // Stop subscription to backend service
  private stopBackendSubscription(): void {
    console.log('[AeroVisionService] Stopping backend subscription');
    
    if (this.unsubscribeFromBackend) {
      this.unsubscribeFromBackend();
      this.unsubscribeFromBackend = null;
    }
  }

  // Transform new SystemState format to legacy AeroVisionData format
  private transformSystemStateToLegacy(systemState: SystemState): AeroVisionData {
    // Transform system status
    const system: AeroVisionSystemData = {
      power_mode: systemState.systemStatus.powerMode,
      power_w: systemState.systemStatus.powerConsumption,
      battery_minutes: systemState.systemStatus.batteryRemaining,
      fps: systemState.systemStatus.fps,
      camera_status: systemState.systemStatus.cameraStatus === 'Connected' ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: systemState.systemStatus.timestamp
    };

    // Transform tracks
    const tracks: AeroVisionTrack[] = systemState.intruders.map(intruder => {
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
            zone: this.extractZoneFromPrediction(threatIntel?.prediction?.nearTerm), 
            confidence: this.mapConfidenceToNumber(threatIntel?.prediction?.confidence) 
          },
          medium: { 
            zone: this.extractZoneFromPrediction(threatIntel?.prediction?.mediumTerm), 
            confidence: this.mapConfidenceToNumber(threatIntel?.prediction?.confidence) * 0.8 
          },
          far: { 
            zone: this.extractZoneFromPrediction(threatIntel?.prediction?.farTerm), 
            confidence: this.mapConfidenceToNumber(threatIntel?.prediction?.confidence) * 0.6 
          }
        },
        explanation: threatIntel?.threatBreakdown?.map(breakdown => ({
          factor: breakdown.factor,
          points: breakdown.score
        })) || []
      };
    });

    // Transform alerts
    const alerts: AeroVisionAlert[] = systemState.alerts.recentAlerts.map(alert => ({
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

  // Extract zone from prediction text
  private extractZoneFromPrediction(predictionText?: string): string {
    if (!predictionText) return 'UNKNOWN';
    
    const zones = ['CRITICAL', 'RESTRICTED', 'BUFFER', 'PUBLIC'];
    for (const zone of zones) {
      if (predictionText.toUpperCase().includes(zone)) {
        return zone;
      }
    }
    return 'UNKNOWN';
  }

  // Map confidence level to numeric value
  private mapConfidenceToNumber(confidence?: string): number {
    switch (confidence?.toLowerCase()) {
      case 'high': return 0.85;
      case 'medium': return 0.65;
      case 'low': return 0.35;
      default: return 0.5;
    }
  }

  // Notify all listeners of new data
  private notifyListeners(data: AeroVisionData): void {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[AeroVisionService] Error in data listener:', error);
      }
    });
  }

  // Cleanup method for proper resource management
  cleanup(): void {
    console.log('[AeroVisionService] Cleaning up resources');
    this.stopBackendSubscription();
    this.listeners = [];
    this.currentLegacyData = null;
  }
}

// Singleton instance - now uses new Backend Service internally
export const aeroVisionService = new AeroVisionService();