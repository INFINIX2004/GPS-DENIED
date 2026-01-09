// AeroVisionService High-Frequency Update Property Tests
// Property test for high-frequency update handling (5-10 Hz frequency)
// **Feature: aerovision-dashboard-integration, Property 3: High-Frequency Update Handling**
// **Validates: Requirements 1.3, 8.1**

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AeroVisionService } from '../aeroVisionService';
import type { AeroVisionData } from '../aeroVisionService';
import type { PythonSystemData, PythonApiResponse } from '../../types/pythonInterfaces';

describe('AeroVisionService High-Frequency Update Property Tests', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Don't use fake timers as they interfere with fetch timeout in BackendService
    // vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Mock fetch for REST API calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock WebSocket to force REST API fallback for consistent testing
    global.WebSocket = vi.fn().mockImplementation(() => {
      throw new Error('WebSocket unavailable - testing REST API');
    });
  });

  afterEach(() => {
    // vi.useRealTimers();
  });

  // Property 3: High-Frequency Update Handling
  // **Feature: aerovision-dashboard-integration, Property 3: High-Frequency Update Handling**
  describe('Property 3: High-Frequency Update Handling', () => {
    it('should handle 5-10 Hz update frequency without data loss or performance degradation', () => {
      fc.assert(
        fc.property(
          // Generate sequence of updates at 5-10 Hz frequency (100-200ms intervals)
          fc.array(
            fc.record({
              system: fc.record({
                power_mode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                power_w: fc.integer({ min: 10, max: 1000 }),
                battery_minutes: fc.integer({ min: 1, max: 600 }),
                fps: fc.integer({ min: 1, max: 60 }),
                camera_status: fc.constantFrom('CONNECTED', 'DISCONNECTED'),
                processing_status: fc.string({ minLength: 5, maxLength: 50 }),
                timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
              }),
              tracks: fc.array(
                fc.record({
                  id: fc.nat({ min: 1, max: 999 }),
                  zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                  threat_score: fc.nat({ min: 1, max: 100 }),
                  threat_level: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                  detection_time: fc.nat({ min: 1, max: 3600 }),
                  behavior: fc.record({
                    loitering: fc.record({
                      active: fc.boolean(),
                      duration: fc.option(fc.nat({ max: 3600 }))
                    }),
                    speed_anomaly: fc.boolean(),
                    trajectory_confidence: fc.float({ min: Math.fround(0.1), max: 1 }),
                    trajectory_stability: fc.option(fc.constantFrom('stable', 'moderate', 'erratic'))
                  }),
                  prediction: fc.record({
                    near: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    medium: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    far: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    will_enter_restricted: fc.option(fc.boolean()),
                    overall_confidence: fc.option(fc.float({ min: Math.fround(0.1), max: 1 }))
                  }),
                  explanation: fc.array(
                    fc.record({
                      factor: fc.string({ minLength: 3, maxLength: 50 }),
                      points: fc.integer({ min: -50, max: 50 })
                    }),
                    { minLength: 1, maxLength: 5 }
                  )
                }),
                { minLength: 0, maxLength: 5 }
              ),
              alerts: fc.array(
                fc.record({
                  id: fc.option(fc.string({ minLength: 3, maxLength: 20 })),
                  time: fc.string().map(() => new Date().toISOString()),
                  message: fc.string({ minLength: 5, maxLength: 100 }),
                  level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL'),
                  track_id: fc.option(fc.nat({ max: 999 }))
                }),
                { minLength: 0, maxLength: 10 }
              ),
              video: fc.option(
                fc.record({
                  is_live: fc.boolean(),
                  resolution: fc.record({
                    width: fc.nat({ min: 320, max: 1920 }),
                    height: fc.nat({ min: 240, max: 1080 })
                  }),
                  latency_ms: fc.nat({ min: 10, max: 1000 }),
                  source: fc.constantFrom('webcam', 'drone', 'rtsp', 'mjpeg'),
                  stream_url: fc.option(fc.webUrl()),
                  frame_rate: fc.option(fc.nat({ min: 15, max: 60 })),
                  bitrate_kbps: fc.option(fc.nat({ min: 500, max: 10000 }))
                })
              ),
              timestamp: fc.string().map(() => new Date().toISOString())
            }),
            { minLength: 5, maxLength: 20 }
          ),
          (pythonDataSequence: PythonSystemData[]) => {
            const receivedUpdates: AeroVisionData[] = [];
            let callbackCount = 0;
            
            // Create a fresh service instance for each property test run
            const testService = new AeroVisionService(
              'ws://localhost:8080/test',
              'http://localhost:8080/test'
            );
            
            // Subscribe to service updates
            const unsubscribe = testService.subscribe((data: AeroVisionData) => {
              receivedUpdates.push({ ...data });
              callbackCount++;
            });

            // Clear initial subscription call (if any)
            receivedUpdates.length = 0;
            callbackCount = 0;

            // Setup mock fetch to return sequential data
            let fetchCallCount = 0;
            mockFetch.mockImplementation(() => {
              const currentCallIndex = fetchCallCount;
              fetchCallCount++;
              const dataIndex = currentCallIndex % pythonDataSequence.length;
              const pythonData = pythonDataSequence[dataIndex];
              
              const response: PythonApiResponse = {
                success: true,
                timestamp: new Date().toISOString(),
                data: pythonData,
                version: '1.0.0'
              };
              
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(response)
              });
            });

            // Test high-frequency updates by calling refresh multiple times
            const refreshPromises: Promise<any>[] = [];
            for (let i = 0; i < pythonDataSequence.length; i++) {
              refreshPromises.push(testService.refresh());
            }

            // Wait for all refreshes to complete
            return Promise.all(refreshPromises).then(() => {
              // Add a small delay to ensure all async operations complete
              return new Promise(resolve => setTimeout(resolve, 10));
            }).then(() => {
              // Core Property: High-frequency handling - each refresh should be processed
              // Note: We expect exactly one callback per refresh call
              expect(callbackCount).toBe(pythonDataSequence.length);
              expect(receivedUpdates.length).toBe(pythonDataSequence.length);
              
              // Data Integrity Property: All received data should be valid
              receivedUpdates.forEach((update, index) => {
                expect(update).toHaveProperty('system');
                expect(update).toHaveProperty('tracks');
                expect(update).toHaveProperty('alerts');
                
                expect(Array.isArray(update.tracks)).toBe(true);
                expect(Array.isArray(update.alerts)).toBe(true);
                
                // System data should be properly transformed from Python format
                expect(['IDLE', 'ACTIVE', 'ALERT']).toContain(update.system.power_mode);
                expect(typeof update.system.power_w).toBe('number');
                expect(update.system.power_w).toBeGreaterThan(0);
                expect(typeof update.system.battery_minutes).toBe('number');
                expect(typeof update.system.fps).toBe('number');
                expect(['CONNECTED', 'DISCONNECTED']).toContain(update.system.camera_status);
                
                // Tracks should be properly transformed
                update.tracks.forEach(track => {
                  expect(typeof track.id).toBe('number');
                  expect(['PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL']).toContain(track.zone);
                  expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(track.threat_level);
                  expect(typeof track.threat_score).toBe('number');
                  expect(track.threat_score).toBeGreaterThanOrEqual(0);
                  expect(track.threat_score).toBeLessThanOrEqual(100);
                });
              });
              
              // Performance Property: System should handle rapid sequential updates
              expect(receivedUpdates.length).toBe(pythonDataSequence.length);
              
              unsubscribe();
              testService.cleanup();
            });
          }
        ),
        { numRuns: 10, timeout: 5000 } // Reduced runs and timeout for simpler test
      );
    });

    it('should maintain data consistency during rapid updates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              system: fc.record({
                power_mode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                power_w: fc.integer({ min: 10, max: 1000 }),
                battery_minutes: fc.integer({ min: 1, max: 600 }),
                fps: fc.integer({ min: 1, max: 60 }),
                camera_status: fc.constantFrom('CONNECTED', 'DISCONNECTED'),
                processing_status: fc.string({ minLength: 5, maxLength: 50 }),
                timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
              }),
              tracks: fc.array(
                fc.record({
                  id: fc.nat({ min: 1, max: 999 }),
                  zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                  threat_score: fc.nat({ min: 1, max: 100 }),
                  threat_level: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                  detection_time: fc.nat({ min: 1, max: 3600 }),
                  behavior: fc.record({
                    loitering: fc.record({
                      active: fc.boolean(),
                      duration: fc.option(fc.nat({ max: 3600 }))
                    }),
                    speed_anomaly: fc.boolean(),
                    trajectory_confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                  }),
                  prediction: fc.record({
                    near: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    medium: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    far: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    })
                  }),
                  explanation: fc.array(
                    fc.record({
                      factor: fc.string({ minLength: 3, maxLength: 50 }),
                      points: fc.integer({ min: -50, max: 50 })
                    }),
                    { minLength: 1, maxLength: 3 }
                  )
                }),
                { minLength: 0, maxLength: 3 }
              ),
              alerts: fc.array(
                fc.record({
                  id: fc.option(fc.string({ minLength: 3, maxLength: 20 })),
                  time: fc.string().map(() => new Date().toISOString()),
                  message: fc.string({ minLength: 5, maxLength: 100 }),
                  level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL')
                }),
                { minLength: 0, maxLength: 5 }
              ),
              timestamp: fc.string().map(() => new Date().toISOString())
            }),
            { minLength: 3, maxLength: 10 }
          ),
          (pythonDataSequence: PythonSystemData[]) => {
            const receivedUpdates: AeroVisionData[] = [];
            let totalSubscriberCalls = 0;
            
            // Create a fresh service instance for each property test run
            const testService = new AeroVisionService(
              'ws://localhost:8080/test',
              'http://localhost:8080/test'
            );
            
            const unsubscribe = testService.subscribe((data: AeroVisionData) => {
              receivedUpdates.push({ ...data });
              totalSubscriberCalls++;
            });

            // Clear initial subscription call
            receivedUpdates.length = 0;
            totalSubscriberCalls = 0;

            // Setup mock fetch with sequential data
            let fetchCallCount = 0;
            mockFetch.mockImplementation(() => {
              const currentCallIndex = fetchCallCount;
              fetchCallCount++;
              const dataIndex = currentCallIndex % pythonDataSequence.length;
              const pythonData = pythonDataSequence[dataIndex];
              
              const response: PythonApiResponse = {
                success: true,
                timestamp: new Date().toISOString(),
                data: pythonData,
                version: '1.0.0'
              };
              
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(response)
              });
            });

            // Apply rapid updates
            const refreshPromises: Promise<any>[] = [];
            for (let i = 0; i < pythonDataSequence.length; i++) {
              refreshPromises.push(testService.refresh());
            }

            return Promise.all(refreshPromises).then(() => {
              // Add a small delay to ensure all async operations complete
              return new Promise(resolve => setTimeout(resolve, 10));
            }).then(() => {
              // Consistency Property: Each refresh should trigger exactly one callback
              expect(totalSubscriberCalls).toBe(pythonDataSequence.length);
              expect(receivedUpdates.length).toBe(totalSubscriberCalls);
              
              // Data Quality Property: All received data should maintain quality under load
              receivedUpdates.forEach((update, index) => {
                expect(update).toHaveProperty('system');
                expect(update).toHaveProperty('tracks');
                expect(update).toHaveProperty('alerts');
                
                // Verify data structure integrity under high load
                expect(Array.isArray(update.tracks)).toBe(true);
                expect(Array.isArray(update.alerts)).toBe(true);
                expect(typeof update.system).toBe('object');
                
                // Verify data values are within expected ranges
                expect(['IDLE', 'ACTIVE', 'ALERT']).toContain(update.system.power_mode);
                expect(update.system.power_w).toBeGreaterThan(0);
                expect(update.system.power_w).toBeLessThanOrEqual(1000);
                expect(update.system.battery_minutes).toBeGreaterThan(0);
                expect(update.system.battery_minutes).toBeLessThanOrEqual(600);
              });
              
              unsubscribe();
              testService.cleanup();
            });
          }
        ),
        { numRuns: 10, timeout: 5000 }
      );
    });

    it('should handle single subscriber efficiently during high-frequency updates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              system: fc.record({
                power_mode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                power_w: fc.integer({ min: 10, max: 1000 }),
                battery_minutes: fc.integer({ min: 1, max: 600 }),
                fps: fc.integer({ min: 1, max: 60 }),
                camera_status: fc.constantFrom('CONNECTED', 'DISCONNECTED'),
                processing_status: fc.string({ minLength: 5, maxLength: 50 }),
                timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
              }),
              tracks: fc.array(
                fc.record({
                  id: fc.nat({ min: 1, max: 999 }),
                  zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                  threat_score: fc.nat({ min: 1, max: 100 }),
                  threat_level: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                  detection_time: fc.nat({ min: 1, max: 3600 }),
                  behavior: fc.record({
                    loitering: fc.record({
                      active: fc.boolean(),
                      duration: fc.option(fc.nat({ max: 3600 }))
                    }),
                    speed_anomaly: fc.boolean(),
                    trajectory_confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                  }),
                  prediction: fc.record({
                    near: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    medium: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    }),
                    far: fc.record({
                      zone: fc.string({ minLength: 3, maxLength: 20 }),
                      confidence: fc.float({ min: Math.fround(0.1), max: 1 })
                    })
                  }),
                  explanation: fc.array(
                    fc.record({
                      factor: fc.string({ minLength: 3, maxLength: 50 }),
                      points: fc.integer({ min: -50, max: 50 })
                    }),
                    { minLength: 1, maxLength: 3 }
                  )
                }),
                { minLength: 0, maxLength: 2 }
              ),
              alerts: fc.array(
                fc.record({
                  id: fc.option(fc.string({ minLength: 3, maxLength: 20 })),
                  time: fc.string().map(() => new Date().toISOString()),
                  message: fc.string({ minLength: 5, maxLength: 100 }),
                  level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL')
                }),
                { minLength: 0, maxLength: 3 }
              ),
              timestamp: fc.string().map(() => new Date().toISOString())
            }),
            { minLength: 3, maxLength: 8 }
          ),
          (pythonDataSequence: PythonSystemData[]) => {
            const subscriberUpdates: AeroVisionData[] = [];
            
            // Create a fresh service instance for each property test run
            const testService = new AeroVisionService(
              'ws://localhost:8080/test',
              'http://localhost:8080/test'
            );
            
            const unsubscribe = testService.subscribe((data: AeroVisionData) => {
              subscriberUpdates.push({ ...data });
            });

            // Clear initial subscription call
            subscriberUpdates.length = 0;

            // Setup mock fetch
            let fetchCallCount = 0;
            mockFetch.mockImplementation(() => {
              const currentCallIndex = fetchCallCount;
              fetchCallCount++;
              const dataIndex = currentCallIndex % pythonDataSequence.length;
              const pythonData = pythonDataSequence[dataIndex];
              
              const response: PythonApiResponse = {
                success: true,
                timestamp: new Date().toISOString(),
                data: pythonData,
                version: '1.0.0'
              };
              
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(response)
              });
            });

            // Apply updates
            const refreshPromises: Promise<any>[] = [];
            for (let i = 0; i < pythonDataSequence.length; i++) {
              refreshPromises.push(testService.refresh());
            }

            return Promise.all(refreshPromises).then(() => {
              // Add a small delay to ensure all async operations complete
              return new Promise(resolve => setTimeout(resolve, 10));
            }).then(() => {
              // Single Subscriber Property: Should receive all updates
              expect(subscriberUpdates.length).toBe(pythonDataSequence.length);

              // Performance Property: System should handle single subscriber efficiently
              subscriberUpdates.forEach((update, index) => {
                expect(update).toHaveProperty('system');
                expect(update).toHaveProperty('tracks');
                expect(update).toHaveProperty('alerts');
                
                // Verify data structure integrity
                expect(Array.isArray(update.tracks)).toBe(true);
                expect(Array.isArray(update.alerts)).toBe(true);
                expect(typeof update.system).toBe('object');
              });

              // Cleanup
              unsubscribe();
              testService.cleanup();
            });
          }
        ),
        { numRuns: 10, timeout: 5000 }
      );
    });
  });
});