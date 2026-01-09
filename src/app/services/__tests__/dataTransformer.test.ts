// DataTransformer Tests
// Unit tests for data transformation between Python and TypeScript interfaces

import { describe, it, expect, beforeEach } from 'vitest';
import { AeroVisionDataTransformer } from '../dataTransformer';
import { PythonSystemData, PythonTrack, PythonAlert } from '../../types/pythonInterfaces';
import { SystemState, DEFAULT_SYSTEM_STATE } from '../../types/systemState';

describe('AeroVisionDataTransformer', () => {
  let transformer: AeroVisionDataTransformer;

  beforeEach(() => {
    transformer = new AeroVisionDataTransformer(false); // Disable logging for tests
  });

  describe('transformSystemData', () => {
    it('should transform valid Python data to SystemState', () => {
      const pythonData: PythonSystemData = {
        system: {
          power_mode: 'ACTIVE',
          power_w: 150,
          battery_minutes: 45,
          fps: 30,
          camera_status: 'CONNECTED',
          processing_status: 'Processing',
          timestamp: '2024-01-08T12:00:00Z'
        },
        tracks: [
          {
            id: 1,
            zone: 'RESTRICTED',
            threat_score: 75,
            threat_level: 'HIGH',
            detection_time: 120,
            behavior: {
              loitering: { active: true, duration: 60 },
              speed_anomaly: false,
              trajectory_confidence: 0.85
            },
            prediction: {
              near: { zone: 'CRITICAL', confidence: 0.9 },
              medium: { zone: 'CRITICAL', confidence: 0.8 },
              far: { zone: 'RESTRICTED', confidence: 0.7 }
            },
            explanation: [
              { factor: 'Zone violation', points: 30 },
              { factor: 'Loitering behavior', points: 25 }
            ]
          }
        ],
        alerts: [
          {
            id: 'alert-1',
            time: '2024-01-08T12:00:00Z',
            message: 'High threat detected',
            level: 'WARNING'
          }
        ],
        video: {
          is_live: true,
          resolution: { width: 1920, height: 1080 },
          latency_ms: 50,
          source: 'drone'
        },
        timestamp: '2024-01-08T12:00:00Z'
      };

      const result = transformer.transformSystemData(pythonData);

      expect(result).toBeDefined();
      expect(result.systemStatus.powerMode).toBe('ACTIVE');
      expect(result.systemStatus.powerConsumption).toBe(150);
      expect(result.systemStatus.cameraStatus).toBe('Connected');
      expect(result.intruders).toHaveLength(1);
      expect(result.intruders[0].trackId).toBe('TRK-001');
      expect(result.intruders[0].threatScore).toBe(75);
      expect(result.alerts.recentAlerts).toHaveLength(1);
      expect(result.videoStatus.isLive).toBe(true);
      expect(result.videoStatus.resolution).toBe('1920x1080');
    });

    it('should return default state for invalid data', () => {
      const invalidData = { invalid: 'data' };
      
      const result = transformer.transformSystemData(invalidData as any);
      
      expect(result).toEqual(DEFAULT_SYSTEM_STATE);
    });
  });

  describe('transformSystemStatus', () => {
    it('should transform Python system status correctly', () => {
      const pythonSystem = {
        power_mode: 'ALERT' as const,
        power_w: 200,
        battery_minutes: 30,
        fps: 25,
        camera_status: 'CONNECTED' as const,
        processing_status: 'Active Processing',
        timestamp: '2024-01-08T12:00:00Z'
      };

      const result = transformer.transformSystemStatus(pythonSystem);

      expect(result.powerMode).toBe('ALERT');
      expect(result.powerConsumption).toBe(200);
      expect(result.batteryRemaining).toBe(30);
      expect(result.fps).toBe(25);
      expect(result.cameraStatus).toBe('Connected');
      expect(result.processingStatus).toBe('Active Processing');
    });

    it('should handle missing fields with defaults', () => {
      const pythonSystem = {
        power_mode: 'IDLE' as const,
        power_w: 0,
        battery_minutes: 0,
        fps: 0,
        camera_status: 'DISCONNECTED' as const,
        timestamp: '2024-01-08T12:00:00Z'
      };

      const result = transformer.transformSystemStatus(pythonSystem);

      expect(result.powerMode).toBe('IDLE');
      expect(result.cameraStatus).toBe('Lost');
      expect(result.processingStatus).toBe('Unknown');
    });
  });

  describe('transformTracks', () => {
    it('should transform Python tracks to IntruderData array', () => {
      const pythonTracks: PythonTrack[] = [
        {
          id: 5,
          zone: 'BUFFER',
          threat_score: 45,
          threat_level: 'MEDIUM',
          detection_time: 90,
          behavior: {
            loitering: { active: false },
            speed_anomaly: true,
            trajectory_confidence: 0.6
          },
          prediction: {
            near: { zone: 'BUFFER', confidence: 0.7 },
            medium: { zone: 'PUBLIC', confidence: 0.5 },
            far: { zone: 'PUBLIC', confidence: 0.3 }
          },
          explanation: []
        }
      ];

      const result = transformer.transformTracks(pythonTracks);

      expect(result).toHaveLength(1);
      expect(result[0].trackId).toBe('TRK-005');
      expect(result[0].zone).toBe('BUFFER');
      expect(result[0].threatScore).toBe(45);
      expect(result[0].threatLevel).toBe('MEDIUM');
      expect(result[0].timeSinceDetection).toBe(90);
    });

    it('should handle empty tracks array', () => {
      const result = transformer.transformTracks([]);
      expect(result).toEqual([]);
    });

    it('should filter out invalid tracks', () => {
      const invalidTracks = [
        { invalid: 'track' },
        null,
        undefined
      ];

      const result = transformer.transformTracks(invalidTracks as any);
      expect(result).toEqual([]);
    });
  });

  describe('transformAlerts', () => {
    it('should transform Python alerts to AlertsData', () => {
      const pythonAlerts: PythonAlert[] = [
        {
          id: 'alert-1',
          time: '2024-01-08T12:00:00Z',
          message: 'Critical threat detected',
          level: 'CRITICAL'
        },
        {
          id: 'alert-2',
          time: '2024-01-08T11:55:00Z',
          message: 'Warning: Unauthorized access',
          level: 'WARNING'
        }
      ];

      const result = transformer.transformAlerts(pythonAlerts);

      expect(result.recentAlerts).toHaveLength(2);
      expect(result.recentAlerts[0].type).toBe('critical');
      expect(result.recentAlerts[1].type).toBe('warning');
      expect(result.alertLevel).toBe('CRITICAL');
      expect(result.recommendation).toContain('Critical');
    });

    it('should calculate correct alert level based on alerts', () => {
      const warningAlerts: PythonAlert[] = [
        { time: '2024-01-08T12:00:00Z', message: 'Warning 1', level: 'WARNING' },
        { time: '2024-01-08T11:55:00Z', message: 'Warning 2', level: 'WARNING' },
        { time: '2024-01-08T11:50:00Z', message: 'Warning 3', level: 'WARNING' }
      ];

      const result = transformer.transformAlerts(warningAlerts);
      expect(result.alertLevel).toBe('HIGH');
    });
  });

  describe('transformVideoStatus', () => {
    it('should transform Python video status correctly', () => {
      const pythonVideo = {
        is_live: true,
        resolution: { width: 1280, height: 720 },
        latency_ms: 100,
        source: 'webcam' as const,
        stream_url: 'http://example.com/stream',
        frame_rate: 30,
        bitrate_kbps: 2000
      };

      const result = transformer.transformVideoStatus(pythonVideo);

      expect(result.isLive).toBe(true);
      expect(result.resolution).toBe('1280x720');
      expect(result.latency).toBe(100);
      expect(result.source).toBe('webcam');
      expect(result.streamUrl).toBe('http://example.com/stream');
      expect(result.frameRate).toBe(30);
      expect(result.bitrate).toBe(2000);
    });

    it('should handle missing video status', () => {
      const result = transformer.transformVideoStatus();

      expect(result.isLive).toBe(false);
      expect(result.resolution).toBe('0x0');
      expect(result.latency).toBe(0);
      expect(result.source).toBe('placeholder');
    });
  });

  describe('validatePythonData', () => {
    it('should validate correct Python data structure', () => {
      const validData: PythonSystemData = {
        system: {
          power_mode: 'IDLE',
          power_w: 0,
          battery_minutes: 0,
          fps: 0,
          camera_status: 'CONNECTED',
          timestamp: '2024-01-08T12:00:00Z'
        },
        tracks: [],
        alerts: [],
        timestamp: '2024-01-08T12:00:00Z'
      };

      expect(transformer.validatePythonData(validData)).toBe(true);
    });

    it('should reject invalid data structures', () => {
      expect(transformer.validatePythonData(null)).toBe(false);
      expect(transformer.validatePythonData(undefined)).toBe(false);
      expect(transformer.validatePythonData({})).toBe(false);
      expect(transformer.validatePythonData({ system: null })).toBe(false);
      expect(transformer.validatePythonData({ system: {}, tracks: 'not-array' })).toBe(false);
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize and clean Python data', () => {
      const dirtyData = {
        system: {
          power_mode: 'ACTIVE',
          power_w: 'invalid-number',
          battery_minutes: null,
          fps: undefined,
          camera_status: 'CONNECTED'
        },
        tracks: [null, undefined, { id: 1 }],
        alerts: [{ message: 'test' }, null],
        timestamp: '2024-01-08T12:00:00Z'
      };

      const result = transformer.sanitizeData(dirtyData as any);

      expect(result.system.power_w).toBe(0); // sanitized invalid number
      expect(result.system.battery_minutes).toBe(0); // sanitized null
      expect(result.system.fps).toBe(0); // sanitized undefined
      expect(result.tracks).toHaveLength(1); // filtered out null/undefined
      expect(result.alerts).toHaveLength(1); // filtered out null
    });
  });
});