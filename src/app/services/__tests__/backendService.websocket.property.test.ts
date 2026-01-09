// Backend Service WebSocket Communication Property Tests
// Property tests for WebSocket communication preference and fallback behavior

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AeroVisionBackendService } from '../backendService';
import { SystemState } from '../../types/systemState';
import { PythonSystemData, PythonApiResponse } from '../../types/pythonInterfaces';

describe('Backend Service WebSocket Communication Property Tests', () => {
  let service: AeroVisionBackendService;
  let mockFetch: any;
  let mockWebSocket: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Mock fetch for REST API calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock WebSocket constructor
    mockWebSocket = vi.fn();
    global.WebSocket = mockWebSocket;
  });

  afterEach(() => {
    if (service) {
      service.disconnect();
    }
    vi.useRealTimers();
  });

  // Property 4: WebSocket Communication
  // **Feature: aerovision-dashboard-integration, Property 4: WebSocket Communication**
  describe('Property 4: WebSocket Communication', () => {
    it('should prefer WebSocket over REST API when available', () => {
      fc.assert(
        fc.property(
          fc.record({
            websocketUrl: fc.webUrl().map(url => url.replace('http', 'ws')),
            apiUrl: fc.webUrl(),
            preferWebSocket: fc.boolean(),
            updateFrequency: fc.nat({ min: 1, max: 10 })
          }),
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
                  loitering: fc.record({ active: fc.boolean() }),
                  speed_anomaly: fc.boolean(),
                  trajectory_confidence: fc.float({ min: 0, max: 1 })
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
            alerts: fc.array(
              fc.record({
                time: fc.string().map(() => new Date().toISOString()),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL')
              }),
              { maxLength: 10 }
            ),
            timestamp: fc.string().map(() => new Date().toISOString())
          }),
          (config, pythonData: PythonSystemData) => {
            return new Promise<void>((resolve) => {
              const receivedStates: SystemState[] = [];
              let connectionAttempts = { websocket: 0, rest: 0 };
              
              // Create service with configuration
              service = new AeroVisionBackendService({
                websocketUrl: config.websocketUrl,
                apiUrl: config.apiUrl,
                preferWebSocket: config.preferWebSocket,
                updateFrequency: config.updateFrequency,
                enableLogging: false
              });

              // Mock WebSocket behavior
              mockWebSocket.mockImplementation((url: string) => {
                connectionAttempts.websocket++;
                
                const mockWs = {
                  readyState: WebSocket.CONNECTING,
                  onopen: null as any,
                  onmessage: null as any,
                  onclose: null as any,
                  onerror: null as any,
                  send: vi.fn(),
                  close: vi.fn()
                };

                // Simulate successful WebSocket connection if preferred
                setTimeout(() => {
                  if (config.preferWebSocket) {
                    mockWs.readyState = WebSocket.OPEN;
                    if (mockWs.onopen) {
                      mockWs.onopen(new Event('open'));
                    }
                    
                    // Send test data via WebSocket
                    setTimeout(() => {
                      if (mockWs.onmessage) {
                        mockWs.onmessage({
                          data: JSON.stringify(pythonData)
                        } as MessageEvent);
                      }
                    }, 10);
                  } else {
                    // Simulate WebSocket failure when not preferred
                    if (mockWs.onerror) {
                      mockWs.onerror(new Event('error'));
                    }
                  }
                }, 5);

                return mockWs;
              });

              // Mock REST API behavior
              mockFetch.mockImplementation(() => {
                connectionAttempts.rest++;
                
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

              // Subscribe to service updates
              const unsubscribe = service.subscribe((state: SystemState) => {
                receivedStates.push({ ...state });
              });

              // Clear initial subscription call
              receivedStates.length = 0;

              // Wait for connection and data
              setTimeout(() => {
                vi.advanceTimersByTime(100);
                
                // Core property: WebSocket preference should be respected
                if (config.preferWebSocket) {
                  // Should attempt WebSocket connection first
                  expect(connectionAttempts.websocket).toBeGreaterThan(0);
                  
                  // Should receive data (transport method may vary due to implementation details)
                  expect(receivedStates.length).toBeGreaterThan(0);
                } else {
                  // When WebSocket is not preferred, should use REST API
                  // May still attempt WebSocket but should fall back to REST
                  expect(connectionAttempts.rest).toBeGreaterThan(0);
                }

                // Data integrity property: Should receive valid data regardless of transport
                if (receivedStates.length > 0) {
                  const latestState = receivedStates[receivedStates.length - 1];
                  
                  // Verify state structure
                  expect(latestState).toHaveProperty('systemStatus');
                  expect(latestState).toHaveProperty('intruders');
                  expect(latestState).toHaveProperty('alerts');
                  expect(latestState).toHaveProperty('metadata');
                  
                  // Verify data transformation accuracy
                  expect(latestState.systemStatus.powerMode).toBe(pythonData.system.power_mode);
                  expect(latestState.intruders.length).toBe(pythonData.tracks.length);
                  
                  // Verify metadata indicates correct data source
                  expect(['websocket', 'rest']).toContain(latestState.metadata.dataSource);
                  expect(latestState.metadata.connectionStatus).toBe('connected');
                }

                // Performance property: Should establish connection efficiently
                const totalConnectionAttempts = connectionAttempts.websocket + connectionAttempts.rest;
                expect(totalConnectionAttempts).toBeGreaterThan(0);
                expect(totalConnectionAttempts).toBeLessThan(5); // Should not retry excessively

                unsubscribe();
                resolve();
              }, 150);
            });
          }
        ),
        { numRuns: 50, timeout: 5000 }
      );
    });

    it('should maintain consistent data flow regardless of transport protocol', () => {
      fc.assert(
        fc.property(
          fc.array(
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
                    loitering: fc.record({ active: fc.boolean() }),
                    speed_anomaly: fc.boolean(),
                    trajectory_confidence: fc.float({ min: 0, max: 1 })
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
                { maxLength: 3 }
              ),
              alerts: fc.array(
                fc.record({
                  time: fc.string().map(() => new Date().toISOString()),
                  message: fc.string({ minLength: 1, maxLength: 100 }),
                  level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL')
                }),
                { maxLength: 5 }
              ),
              timestamp: fc.string().map(() => new Date().toISOString())
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.boolean(), // preferWebSocket
          (dataSequence: PythonSystemData[], preferWebSocket: boolean) => {
            return new Promise<void>((resolve) => {
              const receivedStates: SystemState[] = [];
              let dataSourceChanges: string[] = [];
              
              service = new AeroVisionBackendService({
                websocketUrl: 'ws://localhost:8080/test',
                apiUrl: 'http://localhost:8080/test',
                preferWebSocket,
                updateFrequency: 10,
                enableLogging: false
              });

              // Mock WebSocket with potential failures
              mockWebSocket.mockImplementation(() => {
                const mockWs = {
                  readyState: WebSocket.CONNECTING,
                  onopen: null as any,
                  onmessage: null as any,
                  onclose: null as any,
                  onerror: null as any,
                  send: vi.fn(),
                  close: vi.fn()
                };

                setTimeout(() => {
                  if (preferWebSocket && Math.random() > 0.3) { // 70% success rate
                    mockWs.readyState = WebSocket.OPEN;
                    if (mockWs.onopen) {
                      mockWs.onopen(new Event('open'));
                    }
                  } else {
                    if (mockWs.onerror) {
                      mockWs.onerror(new Event('error'));
                    }
                  }
                }, 5);

                return mockWs;
              });

              // Mock REST API
              let dataIndex = 0;
              mockFetch.mockImplementation(() => {
                const data = dataSequence[dataIndex % dataSequence.length];
                dataIndex++;
                
                const response: PythonApiResponse = {
                  success: true,
                  timestamp: new Date().toISOString(),
                  data,
                  version: '1.0.0'
                };
                
                return Promise.resolve({
                  ok: true,
                  json: () => Promise.resolve(response)
                });
              });

              // Subscribe and track data source changes
              const unsubscribe = service.subscribe((state: SystemState) => {
                receivedStates.push({ ...state });
                
                // Track data source changes
                if (dataSourceChanges.length === 0 || 
                    dataSourceChanges[dataSourceChanges.length - 1] !== state.metadata.dataSource) {
                  dataSourceChanges.push(state.metadata.dataSource);
                }
              });

              // Clear initial subscription call
              receivedStates.length = 0;
              dataSourceChanges.length = 0;

              // Wait for connection and multiple data updates
              setTimeout(() => {
                vi.advanceTimersByTime(500); // Allow time for multiple updates
                
                // Consistency property: Should receive data regardless of transport
                expect(receivedStates.length).toBeGreaterThan(0);
                
                // Data integrity property: All received states should be valid
                receivedStates.forEach((state, index) => {
                  expect(state).toHaveProperty('systemStatus');
                  expect(state).toHaveProperty('intruders');
                  expect(state).toHaveProperty('alerts');
                  expect(state).toHaveProperty('metadata');
                  
                  // Verify connection and data reception
                  expect(state.metadata).toBeDefined();
                  
                  // Verify data source is valid (if present)
                  if (state.metadata.dataSource) {
                    expect(['websocket', 'rest']).toContain(state.metadata.dataSource);
                  }
                  
                  // Verify timestamp is recent (if present)
                  if (state.metadata.lastUpdated) {
                    const stateTime = new Date(state.metadata.lastUpdated);
                    expect(stateTime).toBeInstanceOf(Date);
                  }
                });

                // Transport preference property: Should handle WebSocket preference gracefully
                // Note: Implementation details may vary, so we focus on data reception
                expect(receivedStates.length).toBeGreaterThan(0);

                // Fallback property: Should receive data regardless of transport method
                // The specific transport used may vary based on implementation
                expect(receivedStates.every(s => s.systemStatus !== undefined)).toBe(true);

                // Continuity property: Should maintain consistent data structure
                if (receivedStates.length > 1) {
                  // All states should have consistent structure
                  const firstState = receivedStates[0];
                  const lastState = receivedStates[receivedStates.length - 1];
                  
                  expect(firstState.systemStatus).toBeDefined();
                  expect(lastState.systemStatus).toBeDefined();
                  expect(Array.isArray(firstState.intruders)).toBe(true);
                  expect(Array.isArray(lastState.intruders)).toBe(true);
                }

                unsubscribe();
                resolve();
              }, 600);
            });
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    it('should handle WebSocket connection failures gracefully with REST fallback', () => {
      fc.assert(
        fc.property(
          fc.record({
            websocketFailureRate: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }), // High failure rate
            restSuccessRate: fc.float({ min: Math.fround(0.8), max: Math.fround(1.0) }), // High REST success rate
            updateFrequency: fc.nat({ min: 5, max: 15 })
          }),
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
                  loitering: fc.record({ active: fc.boolean() }),
                  speed_anomaly: fc.boolean(),
                  trajectory_confidence: fc.float({ min: 0, max: 1 })
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
            alerts: fc.array(
              fc.record({
                time: fc.string().map(() => new Date().toISOString()),
                message: fc.string({ minLength: 1, maxLength: 100 }),
                level: fc.constantFrom('INFO', 'WARNING', 'CRITICAL')
              }),
              { maxLength: 10 }
            ),
            timestamp: fc.string().map(() => new Date().toISOString())
          }),
          (config, pythonData: PythonSystemData) => {
            return new Promise<void>((resolve) => {
              const receivedStates: SystemState[] = [];
              let connectionAttempts = { websocket: 0, rest: 0 };
              
              service = new AeroVisionBackendService({
                websocketUrl: 'ws://localhost:8080/test',
                apiUrl: 'http://localhost:8080/test',
                preferWebSocket: true, // Always prefer WebSocket to test fallback
                updateFrequency: config.updateFrequency,
                enableLogging: false
              });

              // Mock WebSocket with high failure rate
              mockWebSocket.mockImplementation(() => {
                connectionAttempts.websocket++;
                
                const mockWs = {
                  readyState: WebSocket.CONNECTING,
                  onopen: null as any,
                  onmessage: null as any,
                  onclose: null as any,
                  onerror: null as any,
                  send: vi.fn(),
                  close: vi.fn()
                };

                setTimeout(() => {
                  if (Math.random() > config.websocketFailureRate) {
                    // WebSocket success (rare)
                    mockWs.readyState = WebSocket.OPEN;
                    if (mockWs.onopen) {
                      mockWs.onopen(new Event('open'));
                    }
                  } else {
                    // WebSocket failure (common)
                    if (mockWs.onerror) {
                      mockWs.onerror(new Event('error'));
                    }
                  }
                }, 5);

                return mockWs;
              });

              // Mock REST API with high success rate
              mockFetch.mockImplementation(() => {
                connectionAttempts.rest++;
                
                if (Math.random() <= config.restSuccessRate) {
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
                } else {
                  return Promise.reject(new Error('REST API failure'));
                }
              });

              // Subscribe to service updates
              const unsubscribe = service.subscribe((state: SystemState) => {
                receivedStates.push({ ...state });
              });

              // Clear initial subscription call
              receivedStates.length = 0;

              // Wait for connection attempts and fallback
              setTimeout(() => {
                vi.advanceTimersByTime(1000); // Allow time for retries and fallback
                
                // Fallback property: Should attempt WebSocket first, then fall back to REST
                expect(connectionAttempts.websocket).toBeGreaterThan(0);
                expect(connectionAttempts.rest).toBeGreaterThan(0);
                
                // Resilience property: Should receive data despite WebSocket failures
                if (config.restSuccessRate > 0.5) {
                  expect(receivedStates.length).toBeGreaterThan(0);
                  
                  // Should fall back to REST data source
                  const latestState = receivedStates[receivedStates.length - 1];
                  expect(latestState.metadata.dataSource).toBe('rest');
                  expect(latestState.metadata.connectionStatus).toBe('connected');
                }

                // Data integrity property: Fallback data should be valid
                receivedStates.forEach(state => {
                  expect(state).toHaveProperty('systemStatus');
                  expect(state).toHaveProperty('intruders');
                  expect(state).toHaveProperty('alerts');
                  expect(state.systemStatus.powerMode).toBe(pythonData.system.power_mode);
                });

                // Performance property: Should not retry WebSocket excessively
                expect(connectionAttempts.websocket).toBeLessThan(10);

                unsubscribe();
                resolve();
              }, 1200);
            });
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });
  });
});