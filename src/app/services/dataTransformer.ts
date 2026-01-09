// Data Transformer Implementation
// Handles conversion between Python surveillance data and TypeScript interfaces
// Provides validation logic and data type conversions with property mapping

import { DataTransformer } from '../types/serviceInterfaces';
import { 
  SystemState, 
  SystemStatusData, 
  IntruderData, 
  ThreatIntelligenceData, 
  AlertsData, 
  VideoStatusData,
  DEFAULT_SYSTEM_STATE 
} from '../types/systemState';
import { 
  PythonSystemData, 
  PythonSystemStatus,
  PythonTrack, 
  PythonAlert, 
  PythonVideoStatus,
  isPythonSystemData,
  isPythonTrack 
} from '../types/pythonInterfaces';

/**
 * Data Transformer for converting Python surveillance data to TypeScript interfaces
 * Implements validation, sanitization, and property mapping between data formats
 */
export class AeroVisionDataTransformer implements DataTransformer {
  private enableLogging: boolean = true;

  constructor(enableLogging: boolean = true) {
    this.enableLogging = enableLogging;
    this.log('DataTransformer initialized');
  }

  /**
   * Main transformation method - converts complete Python system data to SystemState
   */
  transformSystemData(pythonData: PythonSystemData): SystemState {
    this.log('Transforming complete system data');
    
    if (!this.validatePythonData(pythonData)) {
      this.log('Invalid Python data provided, returning default state');
      return { ...DEFAULT_SYSTEM_STATE };
    }

    try {
      const sanitizedData = this.sanitizeData(pythonData);
      
      const systemState: SystemState = {
        systemStatus: this.transformSystemStatus(sanitizedData.system),
        intruders: this.transformTracks(sanitizedData.tracks),
        threatIntelligence: this.transformThreatData(sanitizedData.tracks),
        alerts: this.transformAlerts(sanitizedData.alerts, sanitizedData.tracks),
        videoStatus: this.transformVideoStatus(sanitizedData.video),
        metadata: {
          lastUpdated: new Date().toISOString(),
          connectionStatus: 'connected',
          dataSource: 'websocket',
          updateFrequency: 5,
          errorCount: 0
        }
      };

      this.log('System data transformation completed successfully');
      return systemState;
    } catch (error) {
      this.log('Error during system data transformation', error);
      return { ...DEFAULT_SYSTEM_STATE };
    }
  }

  /**
   * Transform Python system status to TypeScript SystemStatusData
   */
  transformSystemStatus(pythonSystem: PythonSystemStatus): SystemStatusData {
    this.log('Transforming system status data');
    
    try {
      return {
        powerMode: pythonSystem.power_mode || 'IDLE',
        powerConsumption: Math.max(0, pythonSystem.power_w || 0),
        batteryRemaining: Math.max(0, pythonSystem.battery_minutes || 0),
        fps: Math.max(0, pythonSystem.fps || 0),
        processingStatus: pythonSystem.processing_status || 'Unknown',
        cameraStatus: pythonSystem.camera_status === 'CONNECTED' ? 'Connected' : 'Lost',
        timestamp: pythonSystem.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false })
      };
    } catch (error) {
      this.log('Error transforming system status', error);
      return DEFAULT_SYSTEM_STATE.systemStatus;
    }
  }

  /**
   * Transform Python tracks array to TypeScript IntruderData array
   */
  transformTracks(pythonTracks: PythonTrack[]): IntruderData[] {
    this.log(`Transforming ${pythonTracks?.length || 0} tracks`);
    
    if (!Array.isArray(pythonTracks)) {
      this.log('Invalid tracks data - not an array');
      return [];
    }

    try {
      return pythonTracks
        .filter(track => isPythonTrack(track))
        .map((track, index) => ({
          trackId: this.formatTrackId(track.id),
          zone: track.zone || 'PUBLIC',
          threatScore: Math.min(100, Math.max(0, track.threat_score || 0)),
          threatLevel: track.threat_level || 'LOW',
          timeSinceDetection: Math.max(0, track.detection_time || 0)
        }));
    } catch (error) {
      this.log('Error transforming tracks', error);
      return [];
    }
  }

  /**
   * Transform Python tracks to threat intelligence data for selected intruders
   */
  transformThreatData(pythonTracks: PythonTrack[]): Record<string, ThreatIntelligenceData> {
    this.log(`Transforming threat intelligence for ${pythonTracks?.length || 0} tracks`);
    
    if (!Array.isArray(pythonTracks)) {
      return {};
    }

    try {
      const threatIntelligence: Record<string, ThreatIntelligenceData> = {};

      pythonTracks
        .filter(track => isPythonTrack(track))
        .forEach(track => {
          const trackId = this.formatTrackId(track.id);
          
          threatIntelligence[trackId] = {
            threatBreakdown: this.transformThreatBreakdown(track.explanation || []),
            behavioral: this.transformBehavioralAnalysis(track.behavior),
            prediction: this.transformPredictionAnalysis(track.prediction)
          };
        });

      return threatIntelligence;
    } catch (error) {
      this.log('Error transforming threat intelligence', error);
      return {};
    }
  }

  /**
   * Transform Python alerts to TypeScript AlertsData
   */
  transformAlerts(pythonAlerts: PythonAlert[], tracks?: PythonTrack[]): AlertsData {
    this.log(`Transforming ${pythonAlerts?.length || 0} alerts`);
    
    try {
      const recentAlerts = Array.isArray(pythonAlerts) 
        ? pythonAlerts.slice(0, 10).map((alert, index) => ({
            id: alert.id || `alert-${index}`,
            timestamp: alert.time || new Date().toISOString(),
            message: alert.message || 'Unknown alert',
            type: this.mapAlertType(alert.level)
          }))
        : [];

      // Determine overall alert level based on recent alerts and active tracks
      const alertLevel = this.calculateOverallAlertLevel(pythonAlerts, tracks);
      const recommendation = this.generateRecommendation(alertLevel, tracks?.length || 0);

      return {
        alertLevel,
        recommendation,
        recentAlerts
      };
    } catch (error) {
      this.log('Error transforming alerts', error);
      return DEFAULT_SYSTEM_STATE.alerts;
    }
  }

  /**
   * Transform Python video status to TypeScript VideoStatusData
   */
  transformVideoStatus(pythonVideo?: PythonVideoStatus): VideoStatusData {
    this.log('Transforming video status data');
    
    try {
      if (!pythonVideo) {
        return {
          isLive: false,
          resolution: '0x0',
          latency: 0,
          source: 'placeholder'
        };
      }

      return {
        isLive: pythonVideo.is_live || false,
        resolution: pythonVideo.resolution 
          ? `${pythonVideo.resolution.width}x${pythonVideo.resolution.height}`
          : '0x0',
        latency: Math.max(0, pythonVideo.latency_ms || 0),
        source: this.mapVideoSource(pythonVideo.source),
        streamUrl: pythonVideo.stream_url,
        frameRate: pythonVideo.frame_rate,
        bitrate: pythonVideo.bitrate_kbps
      };
    } catch (error) {
      this.log('Error transforming video status', error);
      return DEFAULT_SYSTEM_STATE.videoStatus;
    }
  }

  /**
   * Validate incoming Python data structure
   */
  validatePythonData(data: any): boolean {
    if (!isPythonSystemData(data)) {
      this.log('Data validation failed - not a valid PythonSystemData structure');
      return false;
    }

    // Additional validation checks
    if (!data.system || typeof data.system !== 'object') {
      this.log('Data validation failed - missing or invalid system data');
      return false;
    }

    if (!Array.isArray(data.tracks)) {
      this.log('Data validation failed - tracks is not an array');
      return false;
    }

    if (!Array.isArray(data.alerts)) {
      this.log('Data validation failed - alerts is not an array');
      return false;
    }

    return true;
  }

  /**
   * Sanitize and clean incoming Python data
   */
  sanitizeData(data: PythonSystemData): PythonSystemData {
    this.log('Sanitizing Python data');
    
    try {
      return {
        system: {
          power_mode: data.system?.power_mode || 'IDLE',
          power_w: this.sanitizeNumber(data.system?.power_w, 0),
          battery_minutes: this.sanitizeNumber(data.system?.battery_minutes, 0),
          fps: this.sanitizeNumber(data.system?.fps, 0),
          camera_status: data.system?.camera_status || 'DISCONNECTED',
          processing_status: data.system?.processing_status || 'Unknown',
          timestamp: data.system?.timestamp || new Date().toISOString()
        },
        tracks: Array.isArray(data.tracks) ? data.tracks.filter(track => track && typeof track === 'object') : [],
        alerts: Array.isArray(data.alerts) ? data.alerts.filter(alert => alert && typeof alert === 'object') : [],
        video: data.video,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch (error) {
      this.log('Error sanitizing data', error);
      throw new Error('Data sanitization failed');
    }
  }

  // Private helper methods

  private formatTrackId(id: number): string {
    return `TRK-${String(id).padStart(3, '0')}`;
  }

  private transformThreatBreakdown(explanations: any[]): Array<{ factor: string; score: number }> {
    if (!Array.isArray(explanations)) {
      return [];
    }

    return explanations
      .filter(exp => exp && typeof exp === 'object')
      .map(exp => ({
        factor: exp.factor || 'Unknown',
        score: this.sanitizeNumber(exp.points, 0)
      }));
  }

  private transformBehavioralAnalysis(behavior: any): any {
    if (!behavior || typeof behavior !== 'object') {
      return {
        loitering: false,
        speedAnomaly: false,
        trajectoryStability: 'Stable' as const,
        trajectoryConfidence: 0
      };
    }

    return {
      loitering: behavior.loitering?.active || false,
      loiteringDuration: behavior.loitering?.duration,
      speedAnomaly: behavior.speed_anomaly || false,
      trajectoryStability: this.mapTrajectoryStability(behavior.trajectory_stability),
      trajectoryConfidence: Math.min(100, Math.max(0, (behavior.trajectory_confidence || 0) * 100))
    };
  }

  private transformPredictionAnalysis(prediction: any): any {
    if (!prediction || typeof prediction !== 'object') {
      return {
        nearTerm: 'No prediction available',
        mediumTerm: 'No prediction available',
        farTerm: 'No prediction available',
        confidence: 'Low' as const,
        willEnterRestricted: false
      };
    }

    return {
      nearTerm: prediction.near?.description || `Zone: ${prediction.near?.zone || 'Unknown'}`,
      mediumTerm: prediction.medium?.description || `Zone: ${prediction.medium?.zone || 'Unknown'}`,
      farTerm: prediction.far?.description || `Zone: ${prediction.far?.zone || 'Unknown'}`,
      confidence: this.mapConfidenceLevel(prediction.overall_confidence),
      willEnterRestricted: prediction.will_enter_restricted || false
    };
  }

  private mapAlertType(level: string): 'info' | 'warning' | 'critical' {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
        return 'critical';
      case 'WARNING':
        return 'warning';
      case 'INFO':
      default:
        return 'info';
    }
  }

  private calculateOverallAlertLevel(alerts: PythonAlert[], tracks?: PythonTrack[]): 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return 'NORMAL';
    }

    const criticalAlerts = alerts.filter(alert => alert.level === 'CRITICAL').length;
    const warningAlerts = alerts.filter(alert => alert.level === 'WARNING').length;
    const highThreatTracks = tracks?.filter(track => track.threat_level === 'CRITICAL' || track.threat_level === 'HIGH').length || 0;

    if (criticalAlerts > 0 || highThreatTracks > 2) {
      return 'CRITICAL';
    } else if (warningAlerts > 2 || highThreatTracks > 0) {
      return 'HIGH';
    } else if (warningAlerts > 0 || (tracks?.length || 0) > 0) {
      return 'ELEVATED';
    }

    return 'NORMAL';
  }

  private generateRecommendation(alertLevel: string, trackCount: number): string {
    switch (alertLevel) {
      case 'CRITICAL':
        return 'Immediate action required - Critical threats detected';
      case 'HIGH':
        return 'High alert - Monitor situation closely';
      case 'ELEVATED':
        return `Elevated alert - ${trackCount} active track${trackCount !== 1 ? 's' : ''} detected`;
      case 'NORMAL':
      default:
        return trackCount > 0 
          ? `Normal operations - ${trackCount} track${trackCount !== 1 ? 's' : ''} being monitored`
          : 'Normal operations - No active threats';
    }
  }

  private mapVideoSource(source: string): 'webcam' | 'drone' | 'placeholder' {
    switch (source?.toLowerCase()) {
      case 'webcam':
        return 'webcam';
      case 'drone':
      case 'rtsp':
      case 'mjpeg':
        return 'drone';
      default:
        return 'placeholder';
    }
  }

  private mapTrajectoryStability(stability: string): 'Stable' | 'Moderate' | 'Erratic' {
    switch (stability?.toLowerCase()) {
      case 'stable':
        return 'Stable';
      case 'moderate':
        return 'Moderate';
      case 'erratic':
        return 'Erratic';
      default:
        return 'Stable';
    }
  }

  private mapConfidenceLevel(confidence: number): 'High' | 'Medium' | 'Low' {
    if (confidence >= 0.8) {
      return 'High';
    } else if (confidence >= 0.5) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  private sanitizeNumber(value: any, defaultValue: number): number {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  private log(message: string, error?: any): void {
    if (this.enableLogging) {
      if (error) {
        console.error(`[DataTransformer] ${message}:`, error);
      } else {
        console.log(`[DataTransformer] ${message}`);
      }
    }
  }
}