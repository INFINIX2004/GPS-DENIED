// Overlay Data Mapping Verification
// Verifies that Python overlay data is properly mapped to dashboard components
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5

import { SystemState } from '../types/systemState';
import { PythonSystemData } from '../types/pythonInterfaces';
import { AeroVisionDataTransformer } from '../services/dataTransformer';

/**
 * Verification results for overlay data mapping
 */
export interface OverlayMappingVerification {
  powerMetricsToSystemStatus: boolean;
  zoneStatusToThreatIntelligence: boolean;
  threatScoresToThreatIntelligence: boolean;
  behavioralExplanationsToIntruderList: boolean;
  predictionConfidenceToThreatIntelligence: boolean;
  allMappingsValid: boolean;
  details: {
    powerMetrics: string[];
    zoneStatus: string[];
    threatScores: string[];
    behavioralExplanations: string[];
    predictionConfidence: string[];
  };
}

/**
 * Verifies that all Python overlay data is properly mapped to dashboard components
 */
export class OverlayDataMappingVerifier {
  private transformer: AeroVisionDataTransformer;

  constructor() {
    this.transformer = new AeroVisionDataTransformer(false); // Disable logging for verification
  }

  /**
   * Verify complete overlay data mapping from Python to dashboard components
   */
  verifyOverlayMapping(pythonData: PythonSystemData): OverlayMappingVerification {
    const systemState = this.transformer.transformSystemData(pythonData);
    
    const verification: OverlayMappingVerification = {
      powerMetricsToSystemStatus: false,
      zoneStatusToThreatIntelligence: false,
      threatScoresToThreatIntelligence: false,
      behavioralExplanationsToIntruderList: false,
      predictionConfidenceToThreatIntelligence: false,
      allMappingsValid: false,
      details: {
        powerMetrics: [],
        zoneStatus: [],
        threatScores: [],
        behavioralExplanations: [],
        predictionConfidence: []
      }
    };

    // Requirement 5.1: Power metrics appear in SystemStatus component
    verification.powerMetricsToSystemStatus = this.verifyPowerMetricsMapping(
      pythonData, 
      systemState, 
      verification.details.powerMetrics
    );

    // Requirement 5.2: Zone status information displays in ThreatIntelligence
    verification.zoneStatusToThreatIntelligence = this.verifyZoneStatusMapping(
      pythonData, 
      systemState, 
      verification.details.zoneStatus
    );

    // Requirement 5.3: Threat scores display in ThreatIntelligence
    verification.threatScoresToThreatIntelligence = this.verifyThreatScoresMapping(
      pythonData, 
      systemState, 
      verification.details.threatScores
    );

    // Requirement 5.4: Behavioral explanations show in IntruderList component
    verification.behavioralExplanationsToIntruderList = this.verifyBehavioralExplanationsMapping(
      pythonData, 
      systemState, 
      verification.details.behavioralExplanations
    );

    // Requirement 5.5: Prediction confidence data displays in ThreatIntelligence
    verification.predictionConfidenceToThreatIntelligence = this.verifyPredictionConfidenceMapping(
      pythonData, 
      systemState, 
      verification.details.predictionConfidence
    );

    // Overall verification
    verification.allMappingsValid = 
      verification.powerMetricsToSystemStatus &&
      verification.zoneStatusToThreatIntelligence &&
      verification.threatScoresToThreatIntelligence &&
      verification.behavioralExplanationsToIntruderList &&
      verification.predictionConfidenceToThreatIntelligence;

    return verification;
  }

  /**
   * Requirement 5.1: Verify power metrics are mapped to SystemStatus component
   */
  private verifyPowerMetricsMapping(
    pythonData: PythonSystemData, 
    systemState: SystemState, 
    details: string[]
  ): boolean {
    let isValid = true;

    // Handle null/undefined system data
    if (!pythonData.system) {
      details.push('Python system data is null or undefined');
      return false;
    }

    // Check power mode mapping
    if (pythonData.system.power_mode !== systemState.systemStatus.powerMode) {
      details.push(`Power mode mismatch: Python=${pythonData.system.power_mode}, SystemStatus=${systemState.systemStatus.powerMode}`);
      isValid = false;
    } else {
      details.push(`✓ Power mode correctly mapped: ${systemState.systemStatus.powerMode}`);
    }

    // Check power consumption mapping
    if (pythonData.system.power_w !== systemState.systemStatus.powerConsumption) {
      details.push(`Power consumption mismatch: Python=${pythonData.system.power_w}W, SystemStatus=${systemState.systemStatus.powerConsumption}W`);
      isValid = false;
    } else {
      details.push(`✓ Power consumption correctly mapped: ${systemState.systemStatus.powerConsumption}W`);
    }

    // Check battery remaining mapping
    if (pythonData.system.battery_minutes !== systemState.systemStatus.batteryRemaining) {
      details.push(`Battery remaining mismatch: Python=${pythonData.system.battery_minutes}min, SystemStatus=${systemState.systemStatus.batteryRemaining}min`);
      isValid = false;
    } else {
      details.push(`✓ Battery remaining correctly mapped: ${systemState.systemStatus.batteryRemaining}min`);
    }

    // Check FPS mapping
    if (pythonData.system.fps !== systemState.systemStatus.fps) {
      details.push(`FPS mismatch: Python=${pythonData.system.fps}, SystemStatus=${systemState.systemStatus.fps}`);
      isValid = false;
    } else {
      details.push(`✓ FPS correctly mapped: ${systemState.systemStatus.fps}`);
    }

    // Check camera status mapping
    const expectedCameraStatus = pythonData.system.camera_status === 'CONNECTED' ? 'Connected' : 'Lost';
    if (expectedCameraStatus !== systemState.systemStatus.cameraStatus) {
      details.push(`Camera status mismatch: Python=${pythonData.system.camera_status}, SystemStatus=${systemState.systemStatus.cameraStatus}`);
      isValid = false;
    } else {
      details.push(`✓ Camera status correctly mapped: ${systemState.systemStatus.cameraStatus}`);
    }

    return isValid;
  }

  /**
   * Requirement 5.2: Verify zone status information displays in ThreatIntelligence
   */
  private verifyZoneStatusMapping(
    pythonData: PythonSystemData, 
    systemState: SystemState, 
    details: string[]
  ): boolean {
    let isValid = true;

    // Check that zone information from tracks is available in threat intelligence
    pythonData.tracks.forEach(track => {
      const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
      const threatIntelligence = systemState.threatIntelligence[trackId];
      
      if (!threatIntelligence) {
        details.push(`Missing threat intelligence for track ${trackId} with zone ${track.zone}`);
        isValid = false;
        return;
      }

      // Zone information should be accessible through the intruder data
      const intruder = systemState.intruders.find(i => i.trackId === trackId);
      if (!intruder) {
        details.push(`Missing intruder data for track ${trackId} with zone ${track.zone}`);
        isValid = false;
        return;
      }

      if (intruder.zone !== track.zone) {
        details.push(`Zone mismatch for ${trackId}: Python=${track.zone}, Intruder=${intruder.zone}`);
        isValid = false;
      } else {
        details.push(`✓ Zone status correctly mapped for ${trackId}: ${intruder.zone}`);
      }
    });

    if (pythonData.tracks.length === 0) {
      details.push('✓ No tracks to verify zone status mapping');
    }

    return isValid;
  }

  /**
   * Requirement 5.3: Verify threat scores display in ThreatIntelligence
   */
  private verifyThreatScoresMapping(
    pythonData: PythonSystemData, 
    systemState: SystemState, 
    details: string[]
  ): boolean {
    let isValid = true;

    pythonData.tracks.forEach(track => {
      const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
      const threatIntelligence = systemState.threatIntelligence[trackId];
      
      if (!threatIntelligence) {
        details.push(`Missing threat intelligence for track ${trackId} with threat score ${track.threat_score}`);
        isValid = false;
        return;
      }

      // Check threat breakdown scores
      if (!threatIntelligence.threatBreakdown) {
        details.push(`Missing threat breakdown for ${trackId}`);
        isValid = false;
        return;
      }

      // Verify threat breakdown contains explanation factors
      const pythonExplanation = track.explanation || [];
      if (pythonExplanation.length !== threatIntelligence.threatBreakdown.length) {
        details.push(`Threat breakdown count mismatch for ${trackId}: Python=${pythonExplanation.length}, ThreatIntelligence=${threatIntelligence.threatBreakdown.length}`);
        isValid = false;
      } else {
        details.push(`✓ Threat breakdown correctly mapped for ${trackId}: ${threatIntelligence.threatBreakdown.length} factors`);
      }

      // Verify individual threat factors
      pythonExplanation.forEach((explanation, index) => {
        const breakdown = threatIntelligence.threatBreakdown[index];
        if (!breakdown) return;

        if (explanation.factor !== breakdown.factor || explanation.points !== breakdown.score) {
          details.push(`Threat factor mismatch for ${trackId}[${index}]: Python=${explanation.factor}(${explanation.points}), ThreatIntelligence=${breakdown.factor}(${breakdown.score})`);
          isValid = false;
        }
      });
    });

    if (pythonData.tracks.length === 0) {
      details.push('✓ No tracks to verify threat scores mapping');
    }

    return isValid;
  }

  /**
   * Requirement 5.4: Verify behavioral explanations show in IntruderList component
   */
  private verifyBehavioralExplanationsMapping(
    pythonData: PythonSystemData, 
    systemState: SystemState, 
    details: string[]
  ): boolean {
    let isValid = true;

    pythonData.tracks.forEach(track => {
      const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
      const threatIntelligence = systemState.threatIntelligence[trackId];
      
      if (!threatIntelligence) {
        details.push(`Missing threat intelligence for behavioral data of track ${trackId}`);
        isValid = false;
        return;
      }

      const behavioral = threatIntelligence.behavioral;
      if (!behavioral) {
        details.push(`Missing behavioral analysis for ${trackId}`);
        isValid = false;
        return;
      }

      // Check loitering behavior mapping
      if (track.behavior.loitering.active !== behavioral.loitering) {
        details.push(`Loitering mismatch for ${trackId}: Python=${track.behavior.loitering.active}, Behavioral=${behavioral.loitering}`);
        isValid = false;
      } else {
        details.push(`✓ Loitering behavior correctly mapped for ${trackId}: ${behavioral.loitering}`);
      }

      // Check loitering duration if active
      if (track.behavior.loitering.active && track.behavior.loitering.duration !== behavioral.loiteringDuration) {
        details.push(`Loitering duration mismatch for ${trackId}: Python=${track.behavior.loitering.duration}s, Behavioral=${behavioral.loiteringDuration}s`);
        isValid = false;
      }

      // Check speed anomaly mapping
      if (track.behavior.speed_anomaly !== behavioral.speedAnomaly) {
        details.push(`Speed anomaly mismatch for ${trackId}: Python=${track.behavior.speed_anomaly}, Behavioral=${behavioral.speedAnomaly}`);
        isValid = false;
      } else {
        details.push(`✓ Speed anomaly correctly mapped for ${trackId}: ${behavioral.speedAnomaly}`);
      }

      // Check trajectory stability mapping
      const expectedStability = this.capitalizeFirst(track.behavior.trajectory_stability || 'stable');
      if (expectedStability !== behavioral.trajectoryStability) {
        details.push(`Trajectory stability mismatch for ${trackId}: Python=${track.behavior.trajectory_stability}, Behavioral=${behavioral.trajectoryStability}`);
        isValid = false;
      } else {
        details.push(`✓ Trajectory stability correctly mapped for ${trackId}: ${behavioral.trajectoryStability}`);
      }

      // Check trajectory confidence mapping
      const expectedConfidence = Math.round((track.behavior.trajectory_confidence || 0) * 100);
      if (expectedConfidence !== behavioral.trajectoryConfidence) {
        details.push(`Trajectory confidence mismatch for ${trackId}: Python=${track.behavior.trajectory_confidence * 100}%, Behavioral=${behavioral.trajectoryConfidence}%`);
        isValid = false;
      } else {
        details.push(`✓ Trajectory confidence correctly mapped for ${trackId}: ${behavioral.trajectoryConfidence}%`);
      }
    });

    if (pythonData.tracks.length === 0) {
      details.push('✓ No tracks to verify behavioral explanations mapping');
    }

    return isValid;
  }

  /**
   * Requirement 5.5: Verify prediction confidence data displays in ThreatIntelligence
   */
  private verifyPredictionConfidenceMapping(
    pythonData: PythonSystemData, 
    systemState: SystemState, 
    details: string[]
  ): boolean {
    let isValid = true;

    pythonData.tracks.forEach(track => {
      const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
      const threatIntelligence = systemState.threatIntelligence[trackId];
      
      if (!threatIntelligence) {
        details.push(`Missing threat intelligence for prediction data of track ${trackId}`);
        isValid = false;
        return;
      }

      const prediction = threatIntelligence.prediction;
      if (!prediction) {
        details.push(`Missing prediction analysis for ${trackId}`);
        isValid = false;
        return;
      }

      // Check overall confidence mapping
      const expectedConfidence = this.mapConfidenceLevel(track.prediction.overall_confidence || 0);
      if (expectedConfidence !== prediction.confidence) {
        details.push(`Prediction confidence mismatch for ${trackId}: Python=${track.prediction.overall_confidence}, Prediction=${prediction.confidence}`);
        isValid = false;
      } else {
        details.push(`✓ Prediction confidence correctly mapped for ${trackId}: ${prediction.confidence}`);
      }

      // Check will enter restricted mapping
      const willEnterRestricted = track.prediction.will_enter_restricted || false;
      if (willEnterRestricted !== prediction.willEnterRestricted) {
        details.push(`Will enter restricted mismatch for ${trackId}: Python=${willEnterRestricted}, Prediction=${prediction.willEnterRestricted}`);
        isValid = false;
      } else {
        details.push(`✓ Will enter restricted correctly mapped for ${trackId}: ${prediction.willEnterRestricted}`);
      }

      // Check prediction descriptions are present
      if (!prediction.nearTerm || !prediction.mediumTerm || !prediction.farTerm) {
        details.push(`Missing prediction descriptions for ${trackId}`);
        isValid = false;
      } else {
        details.push(`✓ Prediction descriptions correctly mapped for ${trackId}`);
      }
    });

    if (pythonData.tracks.length === 0) {
      details.push('✓ No tracks to verify prediction confidence mapping');
    }

    return isValid;
  }

  /**
   * Utility: Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Utility: Map confidence level
   */
  private mapConfidenceLevel(confidence: number): 'High' | 'Medium' | 'Low' {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  }
}

/**
 * Create sample Python data for testing overlay mapping
 */
export function createSamplePythonDataWithOverlays(): PythonSystemData {
  return {
    system: {
      power_mode: 'ACTIVE',
      power_w: 45.2,
      battery_minutes: 180,
      fps: 30,
      camera_status: 'CONNECTED',
      processing_status: 'Active Processing',
      timestamp: new Date().toISOString()
    },
    tracks: [
      {
        id: 1,
        zone: 'RESTRICTED',
        threat_score: 75,
        threat_level: 'HIGH',
        detection_time: 120,
        behavior: {
          loitering: {
            active: true,
            duration: 45
          },
          speed_anomaly: false,
          trajectory_confidence: 0.85,
          trajectory_stability: 'moderate'
        },
        prediction: {
          near: {
            zone: 'RESTRICTED',
            confidence: 0.9,
            description: 'Continuing in restricted zone'
          },
          medium: {
            zone: 'CRITICAL',
            confidence: 0.7,
            description: 'Likely to enter critical zone'
          },
          far: {
            zone: 'CRITICAL',
            confidence: 0.6,
            description: 'May remain in critical area'
          },
          will_enter_restricted: true,
          overall_confidence: 0.8
        },
        explanation: [
          { factor: 'Zone Violation', points: 25 },
          { factor: 'Loitering Behavior', points: 20 },
          { factor: 'Trajectory Analysis', points: 15 },
          { factor: 'Speed Pattern', points: 10 },
          { factor: 'Time of Day', points: 5 }
        ]
      },
      {
        id: 2,
        zone: 'BUFFER',
        threat_score: 35,
        threat_level: 'MEDIUM',
        detection_time: 60,
        behavior: {
          loitering: {
            active: false
          },
          speed_anomaly: true,
          trajectory_confidence: 0.6,
          trajectory_stability: 'erratic'
        },
        prediction: {
          near: {
            zone: 'BUFFER',
            confidence: 0.8,
            description: 'Remaining in buffer zone'
          },
          medium: {
            zone: 'PUBLIC',
            confidence: 0.7,
            description: 'Expected to move to public area'
          },
          far: {
            zone: 'PUBLIC',
            confidence: 0.9,
            description: 'Will exit to public zone'
          },
          will_enter_restricted: false,
          overall_confidence: 0.6
        },
        explanation: [
          { factor: 'Speed Anomaly', points: 20 },
          { factor: 'Erratic Movement', points: 15 }
        ]
      }
    ],
    alerts: [
      {
        id: 'alert-001',
        time: new Date().toISOString(),
        message: 'High threat detected in restricted zone',
        level: 'WARNING'
      }
    ],
    video: {
      is_live: true,
      resolution: {
        width: 1920,
        height: 1080
      },
      latency_ms: 150,
      source: 'drone',
      stream_url: 'rtsp://drone.local/stream',
      frame_rate: 30,
      bitrate_kbps: 5000
    },
    timestamp: new Date().toISOString()
  };
}