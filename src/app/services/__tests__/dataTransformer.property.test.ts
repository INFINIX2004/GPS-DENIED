// DataTransformer Property-Based Tests
// Property tests for data transformation accuracy and validation

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AeroVisionDataTransformer } from '../dataTransformer';
import { PythonSystemData, PythonTrack, PythonAlert } from '../../types/pythonInterfaces';
import { isSystemState, isIntruderData, isSystemStatusData } from '../../types';

describe('DataTransformer Property Tests', () => {
  let transformer: AeroVisionDataTransformer;

  beforeEach(() => {
    transformer = new AeroVisionDataTransformer(false); // Disable logging for tests
  });

  // Property 7: Data Transformation Accuracy
  // **Feature: aerovision-dashboard-integration, Property 7: Data Transformation Accuracy**
  describe('Property 7: Data Transformation Accuracy', () => {
    it('should preserve data integrity during transformation', () => {
      fc.assert(
        fc.property(
          // Generator for valid Python system data
          fc.record({
            system: fc.record({
              power_mode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
              power_w: fc.nat({ max: 1000 }),
              battery_minutes: fc.nat({ max: 600 }),
              fps: fc.nat({ max: 60 }),
              camera_status: fc.constantFrom('CONNECTED', 'DISCONNECTED'),
              processing_status: fc.string({ minLength: 1, maxLength: 50 }),
              timestamp: fc.string().map(() => new Date().toISOString())
            }),
            tracks: fc.array(
              fc.record({
                id: fc.nat({ max: 999 }),
                zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                threat_score: fc.nat({ max: 100 }),
                threat_level: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                detection_time: fc.nat({ max: 3600 }),
                behavior: fc.record({
                  loitering: fc.record({
                    active: fc.boolean(),
                    duration: fc.option(fc.nat({ max: 3600 }))
                  }),
                  speed_anomaly: fc.boolean(),
                  trajectory_confidence: fc.float({ min: 0, max: 1 }),
                  trajectory_stability: fc.option(fc.constantFrom('stable', 'moderate', 'erratic'))
                }),
                prediction: fc.record({
                  near: fc.record({
                    zone: fc.string({ minLength: 1, maxLength: 20 }),
                    confidence: fc.float({ min: 0, max: 1 })
                  }),
                  medium: fc.record({
                    zone: fc.string({ minLength: 1, maxLength: 20 }),
                    confidence: fc.float({ min: 0, max: 1 })
                  }),
                  far: fc.record({
                    zone: fc.string({ minLength: 1, maxLength: 20 }),
                    confidence: fc.float({ min: 0, max: 1 })
                  }),
                  will_enter_restricted: fc.option(fc.boolean()),
                  overall_confidence: fc.option(fc.float({ min: 0, max: 1 }))
                }),
                explanation: fc.array(
                  fc.record({
                    factor: fc.string({ minLength: 1, maxLength: 50 }),
                    points: fc.integer({ min: -50, max: 50 })
                  }),
                  { maxLength: 10 }
                )
              }),
              { maxLength: 20 }
            ),
            alerts: fc.array(
              fc.record({
                id: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
                time: fc.string().map(() => new Date().toISOString()),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL'),
                track_id: fc.option(fc.nat({ max: 999 }))
              }),
              { maxLength: 50 }
            ),
            video: fc.option(
              fc.record({
                is_live: fc.boolean(),
                resolution: fc.record({
                  width: fc.nat({ min: 320, max: 4096 }),
                  height: fc.nat({ min: 240, max: 2160 })
                }),
                latency_ms: fc.nat({ max: 5000 }),
                source: fc.constantFrom('webcam', 'drone', 'rtsp', 'mjpeg'),
                stream_url: fc.option(fc.webUrl()),
                frame_rate: fc.option(fc.nat({ min: 1, max: 120 })),
                bitrate_kbps: fc.option(fc.nat({ min: 100, max: 50000 }))
              })
            ),
            timestamp: fc.string().map(() => new Date().toISOString())
          }),
          (pythonData: PythonSystemData) => {
            // Transform the data
            const result = transformer.transformSystemData(pythonData);

            // Verify the result is a valid SystemState
            expect(isSystemState(result)).toBe(true);

            // Verify data integrity - key values should be preserved
            expect(result.systemStatus.powerMode).toBe(pythonData.system.power_mode);
            expect(result.systemStatus.powerConsumption).toBe(pythonData.system.power_w);
            expect(result.systemStatus.batteryRemaining).toBe(pythonData.system.battery_minutes);
            expect(result.systemStatus.fps).toBe(pythonData.system.fps);

            // Verify tracks are transformed correctly
            expect(result.intruders).toHaveLength(pythonData.tracks.length);
            
            // Verify each track maintains its core properties
            pythonData.tracks.forEach((track, index) => {
              const transformedTrack = result.intruders[index];
              expect(transformedTrack.zone).toBe(track.zone);
              expect(transformedTrack.threatScore).toBe(track.threat_score);
              expect(transformedTrack.threatLevel).toBe(track.threat_level);
              expect(transformedTrack.timeSinceDetection).toBe(track.detection_time);
            });

            // Verify alerts are transformed correctly
            expect(result.alerts.recentAlerts.length).toBeLessThanOrEqual(pythonData.alerts.length);

            // Verify video status transformation
            if (pythonData.video) {
              expect(result.videoStatus.isLive).toBe(pythonData.video.is_live);
              expect(result.videoStatus.latency).toBe(pythonData.video.latency_ms);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in numeric values', () => {
      fc.assert(
        fc.property(
          fc.record({
            system: fc.record({
              power_mode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
              power_w: fc.oneof(fc.constant(-100), fc.constant(0), fc.constant(10000)),
              battery_minutes: fc.oneof(fc.constant(-50), fc.constant(0), fc.constant(1000)),
              fps: fc.oneof(fc.constant(-10), fc.constant(0), fc.constant(200)),
              camera_status: fc.constantFrom('CONNECTED', 'DISCONNECTED'),
              timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
            }),
            tracks: fc.array(
              fc.record({
                id: fc.integer({ min: -100, max: 10000 }),
                zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                threat_score: fc.oneof(fc.constant(-50), fc.constant(0), fc.constant(150)),
                threat_level: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                detection_time: fc.oneof(fc.constant(-100), fc.constant(0), fc.constant(10000)),
                behavior: fc.record({
                  loitering: fc.record({ active: fc.boolean() }),
                  speed_anomaly: fc.boolean(),
                  trajectory_confidence: fc.oneof(fc.constant(-1), fc.constant(0), fc.constant(2))
                }),
                prediction: fc.record({
                  near: fc.record({ zone: fc.string(), confidence: fc.float() }),
                  medium: fc.record({ zone: fc.string(), confidence: fc.float() }),
                  far: fc.record({ zone: fc.string(), confidence: fc.float() })
                }),
                explanation: fc.array(fc.record({
                  factor: fc.string(),
                  points: fc.integer()
                }))
              }),
              { maxLength: 5 }
            ),
            alerts: fc.array(fc.record({
              time: fc.string().map(() => new Date().toISOString()),
              message: fc.string(),
              level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL')
            })),
            timestamp: fc.string().map(() => new Date().toISOString())
          }),
          (pythonData: PythonSystemData) => {
            const result = transformer.transformSystemData(pythonData);

            // Verify numeric values are properly sanitized
            expect(result.systemStatus.powerConsumption).toBeGreaterThanOrEqual(0);
            expect(result.systemStatus.batteryRemaining).toBeGreaterThanOrEqual(0);
            expect(result.systemStatus.fps).toBeGreaterThanOrEqual(0);

            // Verify threat scores are clamped to 0-100 range
            result.intruders.forEach(intruder => {
              expect(intruder.threatScore).toBeGreaterThanOrEqual(0);
              expect(intruder.threatScore).toBeLessThanOrEqual(100);
              expect(intruder.timeSinceDetection).toBeGreaterThanOrEqual(0);
            });

            // Verify trajectory confidence is converted to percentage (0-100)
            Object.values(result.threatIntelligence).forEach(threat => {
              expect(threat.behavioral.trajectoryConfidence).toBeGreaterThanOrEqual(0);
              expect(threat.behavioral.trajectoryConfidence).toBeLessThanOrEqual(100);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 13: Data Validation
  // **Feature: aerovision-dashboard-integration, Property 13: Data Validation**
  describe('Property 13: Data Validation', () => {
    it('should reject invalid data structures consistently', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant({}),
            fc.constant([]),
            fc.constant('invalid'),
            fc.constant(123),
            fc.record({
              system: fc.constant(null)
            }),
            fc.record({
              system: fc.record({}),
              tracks: fc.constant('not-array')
            }),
            fc.record({
              system: fc.record({}),
              tracks: fc.array(fc.anything()),
              alerts: fc.constant('not-array')
            })
          ),
          (invalidData: any) => {
            const isValid = transformer.validatePythonData(invalidData);
            
            // Invalid data should always be rejected
            expect(isValid).toBe(false);
            
            // When invalid data is transformed, should return default state
            const result = transformer.transformSystemData(invalidData);
            expect(isSystemState(result)).toBe(true);
            
            // Should have safe default values
            expect(result.systemStatus.powerConsumption).toBeGreaterThanOrEqual(0);
            expect(result.systemStatus.batteryRemaining).toBeGreaterThanOrEqual(0);
            expect(result.systemStatus.fps).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(result.intruders)).toBe(true);
            expect(Array.isArray(result.alerts.recentAlerts)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate required fields in Python data', () => {
      fc.assert(
        fc.property(
          fc.record({
            system: fc.option(fc.record({
              power_mode: fc.option(fc.constantFrom('IDLE', 'ACTIVE', 'ALERT')),
              power_w: fc.option(fc.nat()),
              battery_minutes: fc.option(fc.nat()),
              fps: fc.option(fc.nat()),
              camera_status: fc.option(fc.constantFrom('CONNECTED', 'DISCONNECTED')),
              timestamp: fc.option(fc.string().map(() => new Date().toISOString()))
            })),
            tracks: fc.option(fc.array(fc.anything())),
            alerts: fc.option(fc.array(fc.anything())),
            timestamp: fc.option(fc.string().map(() => new Date().toISOString()))
          }),
          (partialData: any) => {
            const isValid = transformer.validatePythonData(partialData);
            
            if (isValid) {
              // If validation passes, transformation should succeed
              const result = transformer.transformSystemData(partialData);
              expect(isSystemState(result)).toBe(true);
              expect(isSystemStatusData(result.systemStatus)).toBe(true);
              expect(Array.isArray(result.intruders)).toBe(true);
              
              // All intruders should be valid
              result.intruders.forEach(intruder => {
                expect(isIntruderData(intruder)).toBe(true);
              });
            } else {
              // If validation fails, should return default state
              const result = transformer.transformSystemData(partialData);
              expect(result.systemStatus.powerMode).toBe('IDLE');
              expect(result.systemStatus.cameraStatus).toBe('Lost');
              expect(result.intruders).toEqual([]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sanitize malformed data consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            system: fc.record({
              power_mode: fc.oneof(fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'), fc.constant(null), fc.constant(undefined)),
              power_w: fc.oneof(fc.nat(), fc.constant('invalid'), fc.constant(null), fc.constant(undefined)),
              battery_minutes: fc.oneof(fc.nat(), fc.constant('invalid'), fc.constant(null)),
              fps: fc.oneof(fc.nat(), fc.constant('invalid'), fc.constant(undefined)),
              camera_status: fc.oneof(fc.constantFrom('CONNECTED', 'DISCONNECTED'), fc.constant(null)),
              timestamp: fc.oneof(fc.string().map(() => new Date().toISOString()), fc.constant(null))
            }),
            tracks: fc.array(
              fc.oneof(
                fc.record({
                  id: fc.oneof(fc.nat(), fc.constant('invalid'), fc.constant(null)),
                  zone: fc.oneof(fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'), fc.constant(null)),
                  threat_score: fc.oneof(fc.nat(), fc.constant('invalid')),
                  threat_level: fc.oneof(fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'), fc.constant(null)),
                  detection_time: fc.oneof(fc.nat(), fc.constant('invalid')),
                  behavior: fc.record({
                    loitering: fc.record({ active: fc.boolean() }),
                    speed_anomaly: fc.boolean(),
                    trajectory_confidence: fc.oneof(fc.float(), fc.constant('invalid'))
                  }),
                  prediction: fc.record({
                    near: fc.record({ zone: fc.string(), confidence: fc.float() }),
                    medium: fc.record({ zone: fc.string(), confidence: fc.float() }),
                    far: fc.record({ zone: fc.string(), confidence: fc.float() })
                  }),
                  explanation: fc.array(fc.record({
                    factor: fc.string(),
                    points: fc.oneof(fc.integer(), fc.constant('invalid'))
                  }))
                }),
                fc.constant(null),
                fc.constant(undefined)
              )
            ),
            alerts: fc.array(
              fc.oneof(
                fc.record({
                  time: fc.oneof(fc.string().map(() => new Date().toISOString()), fc.constant(null)),
                  message: fc.oneof(fc.string(), fc.constant(null)),
                  level: fc.oneof(fc.constantFrom('INFO', 'WARNING', 'CRITICAL'), fc.constant(null))
                }),
                fc.constant(null)
              )
            ),
            timestamp: fc.oneof(fc.string().map(() => new Date().toISOString()), fc.constant(null))
          }),
          (malformedData: any) => {
            // Sanitization should always produce clean data
            const sanitized = transformer.sanitizeData(malformedData);
            
            // Sanitized data should have proper structure
            expect(sanitized).toHaveProperty('system');
            expect(sanitized).toHaveProperty('tracks');
            expect(sanitized).toHaveProperty('alerts');
            expect(sanitized).toHaveProperty('timestamp');
            
            // System should have valid defaults for invalid values
            expect(typeof sanitized.system.power_mode).toBe('string');
            expect(typeof sanitized.system.power_w).toBe('number');
            expect(typeof sanitized.system.battery_minutes).toBe('number');
            expect(typeof sanitized.system.fps).toBe('number');
            expect(typeof sanitized.system.camera_status).toBe('string');
            expect(typeof sanitized.system.timestamp).toBe('string');
            
            // Arrays should be properly filtered
            expect(Array.isArray(sanitized.tracks)).toBe(true);
            expect(Array.isArray(sanitized.alerts)).toBe(true);
            
            // Null/undefined items should be filtered out
            sanitized.tracks.forEach((track: any) => {
              expect(track).not.toBeNull();
              expect(track).not.toBeUndefined();
              expect(typeof track).toBe('object');
            });
            
            sanitized.alerts.forEach((alert: any) => {
              expect(alert).not.toBeNull();
              expect(alert).not.toBeUndefined();
              expect(typeof alert).toBe('object');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});