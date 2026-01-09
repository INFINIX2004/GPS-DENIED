// Interface Tests
// Verify that TypeScript interfaces work correctly with data structures

import {
  SystemState,
  SystemStatusData,
  IntruderData,
  ThreatIntelligenceData,
  AlertsData,
  VideoStatusData,
  DEFAULT_SYSTEM_STATE,
  PythonSystemData,
  isPythonSystemData,
  isSystemState,
  isIntruderData,
  isSystemStatusData
} from '../index';

describe('TypeScript Interface Tests', () => {
  describe('SystemState Interface', () => {
    test('DEFAULT_SYSTEM_STATE should match SystemState interface', () => {
      const state: SystemState = DEFAULT_SYSTEM_STATE;
      
      expect(state.systemStatus).toBeDefined();
      expect(state.intruders).toBeInstanceOf(Array);
      expect(state.threatIntelligence).toBeDefined();
      expect(state.alerts).toBeDefined();
      expect(state.videoStatus).toBeDefined();
      expect(state.metadata).toBeDefined();
    });

    test('should create valid SystemStatusData', () => {
      const systemStatus: SystemStatusData = {
        powerMode: 'ACTIVE',
        powerConsumption: 8.5,
        batteryRemaining: 420,
        fps: 24.7,
        processingStatus: 'Normal',
        cameraStatus: 'Connected',
        timestamp: '12:34:56'
      };

      expect(systemStatus.powerMode).toBe('ACTIVE');
      expect(typeof systemStatus.powerConsumption).toBe('number');
      expect(typeof systemStatus.batteryRemaining).toBe('number');
    });

    test('should create valid IntruderData', () => {
      const intruder: IntruderData = {
        trackId: 'TRK-001',
        zone: 'RESTRICTED',
        threatScore: 75,
        threatLevel: 'HIGH',
        timeSinceDetection: 120
      };

      expect(intruder.trackId).toBe('TRK-001');
      expect(intruder.zone).toBe('RESTRICTED');
      expect(intruder.threatLevel).toBe('HIGH');
    });

    test('should create valid ThreatIntelligenceData', () => {
      const threatData: ThreatIntelligenceData = {
        threatBreakdown: [
          { factor: 'Zone violation', score: 30 },
          { factor: 'Loitering detected', score: 15 }
        ],
        behavioral: {
          loitering: true,
          loiteringDuration: 96,
          speedAnomaly: false,
          trajectoryStability: 'Stable',
          trajectoryConfidence: 84
        },
        prediction: {
          nearTerm: 'Will remain in RESTRICTED zone',
          mediumTerm: 'May move to CRITICAL zone',
          farTerm: 'Likely to exit area',
          confidence: 'High',
          willEnterRestricted: false
        }
      };

      expect(threatData.threatBreakdown).toHaveLength(2);
      expect(threatData.behavioral.loitering).toBe(true);
      expect(threatData.prediction.confidence).toBe('High');
    });

    test('should create valid AlertsData', () => {
      const alerts: AlertsData = {
        alertLevel: 'HIGH',
        recommendation: 'Deploy security response team',
        recentAlerts: [
          {
            id: 'A1',
            timestamp: '12:03:21',
            message: 'Entered RESTRICTED zone',
            type: 'warning'
          }
        ]
      };

      expect(alerts.alertLevel).toBe('HIGH');
      expect(alerts.recentAlerts).toHaveLength(1);
      expect(alerts.recentAlerts[0].type).toBe('warning');
    });

    test('should create valid VideoStatusData', () => {
      const videoStatus: VideoStatusData = {
        isLive: true,
        resolution: '1920x1080',
        latency: 45,
        source: 'drone',
        streamUrl: 'rtsp://example.com/stream',
        frameRate: 30,
        bitrate: 2000
      };

      expect(videoStatus.isLive).toBe(true);
      expect(videoStatus.source).toBe('drone');
      expect(videoStatus.frameRate).toBe(30);
    });
  });

  describe('Python Interface Compatibility', () => {
    test('should create valid PythonSystemData', () => {
      const pythonData: PythonSystemData = {
        system: {
          power_mode: 'ACTIVE',
          power_w: 8.6,
          battery_minutes: 420,
          fps: 24.7,
          camera_status: 'CONNECTED',
          processing_status: 'Normal',
          timestamp: '12:34:56'
        },
        tracks: [
          {
            id: 3,
            zone: 'RESTRICTED',
            threat_score: 75,
            threat_level: 'HIGH',
            detection_time: 120,
            behavior: {
              loitering: { active: true, duration: 96 },
              speed_anomaly: false,
              trajectory_confidence: 0.84
            },
            prediction: {
              near: { zone: 'RESTRICTED', confidence: 0.84 },
              medium: { zone: 'CRITICAL', confidence: 0.71 },
              far: { zone: 'CRITICAL', confidence: 0.55 }
            },
            explanation: [
              { factor: 'Zone violation', points: 30 },
              { factor: 'Loitering detected', points: 15 }
            ]
          }
        ],
        alerts: [
          {
            time: '12:03:21',
            message: 'Entered RESTRICTED zone',
            level: 'WARNING'
          }
        ],
        timestamp: '2024-01-08T12:34:56Z'
      };

      expect(pythonData.system.power_mode).toBe('ACTIVE');
      expect(pythonData.tracks).toHaveLength(1);
      expect(pythonData.alerts).toHaveLength(1);
    });
  });

  describe('Type Guards', () => {
    test('isPythonSystemData should validate correctly', () => {
      const validData = {
        system: { power_mode: 'ACTIVE' },
        tracks: [],
        alerts: [],
        timestamp: '2024-01-08T12:34:56Z'
      };

      const invalidData = {
        system: { power_mode: 'ACTIVE' },
        // missing tracks and alerts
        timestamp: '2024-01-08T12:34:56Z'
      };

      expect(isPythonSystemData(validData)).toBe(true);
      expect(isPythonSystemData(invalidData)).toBe(false);
      expect(isPythonSystemData(null)).toBe(false);
      expect(isPythonSystemData(undefined)).toBe(false);
    });

    test('isSystemState should validate correctly', () => {
      expect(isSystemState(DEFAULT_SYSTEM_STATE)).toBe(true);
      expect(isSystemState({})).toBe(false);
      expect(isSystemState(null)).toBe(false);
    });

    test('isIntruderData should validate correctly', () => {
      const validIntruder = {
        trackId: 'TRK-001',
        zone: 'RESTRICTED',
        threatScore: 75,
        threatLevel: 'HIGH',
        timeSinceDetection: 120
      };

      const invalidIntruder = {
        trackId: 'TRK-001',
        // missing required fields
      };

      expect(isIntruderData(validIntruder)).toBe(true);
      expect(isIntruderData(invalidIntruder)).toBe(false);
    });

    test('isSystemStatusData should validate correctly', () => {
      const validStatus = {
        powerMode: 'ACTIVE',
        powerConsumption: 8.5,
        batteryRemaining: 420,
        fps: 24.7,
        processingStatus: 'Normal',
        cameraStatus: 'Connected',
        timestamp: '12:34:56'
      };

      expect(isSystemStatusData(validStatus)).toBe(true);
      expect(isSystemStatusData({})).toBe(false);
    });
  });

  describe('Enum Constraints', () => {
    test('should enforce power mode constraints', () => {
      const validModes: SystemStatusData['powerMode'][] = ['IDLE', 'ACTIVE', 'ALERT'];
      
      validModes.forEach(mode => {
        const status: SystemStatusData = {
          powerMode: mode,
          powerConsumption: 0,
          batteryRemaining: 0,
          fps: 0,
          processingStatus: 'Test',
          cameraStatus: 'Connected',
          timestamp: '00:00:00'
        };
        expect(status.powerMode).toBe(mode);
      });
    });

    test('should enforce zone constraints', () => {
      const validZones: IntruderData['zone'][] = ['PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'];
      
      validZones.forEach(zone => {
        const intruder: IntruderData = {
          trackId: 'TRK-001',
          zone: zone,
          threatScore: 50,
          threatLevel: 'MEDIUM',
          timeSinceDetection: 60
        };
        expect(intruder.zone).toBe(zone);
      });
    });

    test('should enforce threat level constraints', () => {
      const validLevels: IntruderData['threatLevel'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      
      validLevels.forEach(level => {
        const intruder: IntruderData = {
          trackId: 'TRK-001',
          zone: 'PUBLIC',
          threatScore: 25,
          threatLevel: level,
          timeSinceDetection: 30
        };
        expect(intruder.threatLevel).toBe(level);
      });
    });
  });

  describe('Optional Properties', () => {
    test('should handle optional properties correctly', () => {
      const minimalVideoStatus: VideoStatusData = {
        isLive: false,
        resolution: '0x0',
        latency: 0,
        source: 'placeholder'
        // streamUrl, frameRate, bitrate are optional
      };

      expect(minimalVideoStatus.streamUrl).toBeUndefined();
      expect(minimalVideoStatus.frameRate).toBeUndefined();
      expect(minimalVideoStatus.bitrate).toBeUndefined();
    });

    test('should handle optional behavioral properties', () => {
      const minimalBehavioral: ThreatIntelligenceData['behavioral'] = {
        loitering: false,
        // loiteringDuration is optional when loitering is false
        speedAnomaly: false,
        trajectoryStability: 'Stable',
        trajectoryConfidence: 95
      };

      expect(minimalBehavioral.loiteringDuration).toBeUndefined();
    });
  });
});