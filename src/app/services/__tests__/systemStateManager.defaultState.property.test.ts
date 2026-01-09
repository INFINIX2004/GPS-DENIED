// SystemStateManager Default State Property Tests
// Property tests for default state provision when no data is available

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SystemStateManager } from '../systemStateManager';
import { 
  SystemState, 
  DEFAULT_SYSTEM_STATE
} from '../../types/systemState';
import {
  isSystemState,
  isSystemStatusData,
  isIntruderData
} from '../../types';

describe('SystemStateManager Default State Property Tests', () => {
  let manager: SystemStateManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SystemStateManager({
      enableLogging: false,
      batchUpdateDelay: 16,
      maxHistorySize: 10,
      memoryCleanupInterval: 1000
    });
  });

  afterEach(() => {
    manager.cleanup();
    vi.useRealTimers();
  });

  // Property 5: Default State Provision
  // **Feature: aerovision-dashboard-integration, Property 5: Default State Provision**
  describe('Property 5: Default State Provision', () => {
    it('should provide valid empty states when no data is available', () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 1, max: 5 }), // Number of subscribers
          (subscriberCount: number) => {
            const receivedStates: SystemState[] = [];
            const unsubscribeFunctions: (() => void)[] = [];

            // Create multiple subscribers
            for (let i = 0; i < subscriberCount; i++) {
              const unsubscribe = manager.subscribe((state: SystemState) => {
                receivedStates.push({ ...state });
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Process any batched updates
            vi.advanceTimersByTime(20);

            // Core property: Should provide default state immediately to all subscribers
            expect(receivedStates.length).toBe(subscriberCount);

            // Verify all received states are valid default states
            receivedStates.forEach(state => {
              // Structure validation
              expect(isSystemState(state)).toBe(true);
              expect(isSystemStatusData(state.systemStatus)).toBe(true);
              expect(Array.isArray(state.intruders)).toBe(true);
              expect(Array.isArray(state.alerts.recentAlerts)).toBe(true);
              expect(typeof state.threatIntelligence).toBe('object');

              // Default values validation
              expect(state.systemStatus.powerMode).toBe('IDLE');
              expect(state.systemStatus.powerConsumption).toBe(0);
              expect(state.systemStatus.batteryRemaining).toBe(0);
              expect(state.systemStatus.fps).toBe(0);
              expect(state.systemStatus.cameraStatus).toBe('Lost');
              expect(state.systemStatus.processingStatus).toBe('Offline');

              // Empty collections validation
              expect(state.intruders).toEqual([]);
              expect(state.alerts.recentAlerts).toEqual([]);
              expect(state.threatIntelligence).toEqual({});

              // Alert level should be normal when no data
              expect(state.alerts.alertLevel).toBe('NORMAL');
              expect(state.alerts.recommendation).toContain('offline');

              // Video status should indicate no live feed
              expect(state.videoStatus.isLive).toBe(false);
              expect(state.videoStatus.source).toBe('placeholder');
              expect(state.videoStatus.resolution).toBe('0x0');

              // Metadata should indicate disconnected state
              expect(state.metadata.connectionStatus).toBe('disconnected');
              expect(state.metadata.dataSource).toBe('mock');
              expect(typeof state.metadata.lastUpdated).toBe('string');
              expect(new Date(state.metadata.lastUpdated)).toBeInstanceOf(Date);
            });

            // Consistency property: All subscribers should receive identical default states
            if (subscriberCount > 1) {
              const firstState = receivedStates[0];
              receivedStates.forEach(state => {
                expect(state.systemStatus).toEqual(firstState.systemStatus);
                expect(state.intruders).toEqual(firstState.intruders);
                expect(state.alerts.alertLevel).toBe(firstState.alerts.alertLevel);
                expect(state.videoStatus.isLive).toBe(firstState.videoStatus.isLive);
                expect(state.metadata.connectionStatus).toBe(firstState.metadata.connectionStatus);
              });
            }

            // Cleanup
            unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain valid state structure even with invalid partial updates', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant({}),
            fc.record({
              systemStatus: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant({}))
            }),
            fc.record({
              intruders: fc.oneof(fc.constant(null), fc.constant('invalid'), fc.constant(123))
            }),
            fc.record({
              alerts: fc.oneof(fc.constant(null), fc.constant([]), fc.constant('invalid'))
            }),
            fc.record({
              videoStatus: fc.oneof(fc.constant(null), fc.constant('invalid'))
            }),
            fc.record({
              threatIntelligence: fc.oneof(fc.constant(null), fc.constant([]), fc.constant('invalid'))
            })
          ),
          (invalidUpdate: any) => {
            const receivedStates: SystemState[] = [];
            
            const unsubscribe = manager.subscribe((state: SystemState) => {
              receivedStates.push({ ...state });
            });

            // Clear initial subscription call
            receivedStates.length = 0;

            // Apply invalid update
            manager.updateState(invalidUpdate);
            vi.advanceTimersByTime(20);

            // Should have received at least the initial state, possibly more with the update
            expect(receivedStates.length).toBeGreaterThan(0);

            const finalState = receivedStates[receivedStates.length - 1];

            // Core property: State should remain valid despite invalid input
            expect(isSystemState(finalState)).toBe(true);

            // Structure integrity property: All required properties should exist
            expect(finalState).toHaveProperty('systemStatus');
            expect(finalState).toHaveProperty('intruders');
            expect(finalState).toHaveProperty('threatIntelligence');
            expect(finalState).toHaveProperty('alerts');
            expect(finalState).toHaveProperty('videoStatus');
            expect(finalState).toHaveProperty('metadata');

            // Type safety property: All properties should have correct types
            expect(typeof finalState.systemStatus).toBe('object');
            expect(Array.isArray(finalState.intruders)).toBe(true);
            expect(typeof finalState.threatIntelligence).toBe('object');
            expect(typeof finalState.alerts).toBe('object');
            expect(Array.isArray(finalState.alerts.recentAlerts)).toBe(true);
            expect(typeof finalState.videoStatus).toBe('object');
            expect(typeof finalState.metadata).toBe('object');

            // Default values property: Invalid updates should not corrupt valid defaults
            expect(['IDLE', 'ACTIVE', 'ALERT']).toContain(finalState.systemStatus.powerMode);
            expect(typeof finalState.systemStatus.powerConsumption).toBe('number');
            expect(finalState.systemStatus.powerConsumption).toBeGreaterThanOrEqual(0);
            expect(typeof finalState.systemStatus.batteryRemaining).toBe('number');
            expect(finalState.systemStatus.batteryRemaining).toBeGreaterThanOrEqual(0);
            expect(['Connected', 'Lost']).toContain(finalState.systemStatus.cameraStatus);

            // Alert level should be valid
            expect(['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL']).toContain(finalState.alerts.alertLevel);
            expect(typeof finalState.alerts.recommendation).toBe('string');

            // Video status should be valid
            expect(typeof finalState.videoStatus.isLive).toBe('boolean');
            expect(['webcam', 'drone', 'placeholder']).toContain(finalState.videoStatus.source);

            // Metadata should be valid
            expect(['connected', 'connecting', 'disconnected']).toContain(finalState.metadata.connectionStatus);
            expect(['websocket', 'rest', 'mock']).toContain(finalState.metadata.dataSource);

            unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide consistent default states across multiple manager instances', () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 2, max: 5 }), // Number of manager instances
          (managerCount: number) => {
            const managers: SystemStateManager[] = [];
            const allReceivedStates: SystemState[][] = [];

            // Create multiple manager instances
            for (let i = 0; i < managerCount; i++) {
              const mgr = new SystemStateManager({
                enableLogging: false,
                batchUpdateDelay: 16,
                maxHistorySize: 10,
                memoryCleanupInterval: 1000
              });
              managers.push(mgr);
              allReceivedStates[i] = [];

              // Subscribe to each manager
              mgr.subscribe((state: SystemState) => {
                allReceivedStates[i].push({ ...state });
              });
            }

            // Process any batched updates
            vi.advanceTimersByTime(20);

            // Consistency property: All managers should provide identical default states
            expect(allReceivedStates.length).toBe(managerCount);
            
            allReceivedStates.forEach((states, index) => {
              expect(states.length).toBeGreaterThan(0);
            });

            // Compare default states across all managers (only if we have states)
            if (allReceivedStates.every(states => states.length > 0)) {
              const firstManagerState = allReceivedStates[0][0];
            
            for (let i = 1; i < managerCount; i++) {
              const otherManagerState = allReceivedStates[i][0];
              
              // System status should be identical
              expect(otherManagerState.systemStatus.powerMode).toBe(firstManagerState.systemStatus.powerMode);
              expect(otherManagerState.systemStatus.powerConsumption).toBe(firstManagerState.systemStatus.powerConsumption);
              expect(otherManagerState.systemStatus.batteryRemaining).toBe(firstManagerState.systemStatus.batteryRemaining);
              expect(otherManagerState.systemStatus.fps).toBe(firstManagerState.systemStatus.fps);
              expect(otherManagerState.systemStatus.cameraStatus).toBe(firstManagerState.systemStatus.cameraStatus);
              expect(otherManagerState.systemStatus.processingStatus).toBe(firstManagerState.systemStatus.processingStatus);

              // Collections should be identical
              expect(otherManagerState.intruders).toEqual(firstManagerState.intruders);
              expect(otherManagerState.alerts.recentAlerts).toEqual(firstManagerState.alerts.recentAlerts);
              expect(otherManagerState.threatIntelligence).toEqual(firstManagerState.threatIntelligence);

              // Alert level should be identical
              expect(otherManagerState.alerts.alertLevel).toBe(firstManagerState.alerts.alertLevel);

              // Video status should be identical
              expect(otherManagerState.videoStatus.isLive).toBe(firstManagerState.videoStatus.isLive);
              expect(otherManagerState.videoStatus.source).toBe(firstManagerState.videoStatus.source);
              expect(otherManagerState.videoStatus.resolution).toBe(firstManagerState.videoStatus.resolution);

              // Connection status should be identical
              expect(otherManagerState.metadata.connectionStatus).toBe(firstManagerState.metadata.connectionStatus);
              expect(otherManagerState.metadata.dataSource).toBe(firstManagerState.metadata.dataSource);
            }
            }

            // Cleanup all managers
            managers.forEach(mgr => mgr.cleanup());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle subscriber errors gracefully while maintaining default state', () => {
      fc.assert(
        fc.property(
          fc.nat({ min: 1, max: 3 }), // Number of error-throwing subscribers
          fc.nat({ min: 1, max: 3 }), // Number of normal subscribers
          (errorSubscriberCount: number, normalSubscriberCount: number) => {
            const normalSubscriberStates: SystemState[] = [];
            const unsubscribeFunctions: (() => void)[] = [];

            // Create error-throwing subscribers
            for (let i = 0; i < errorSubscriberCount; i++) {
              const unsubscribe = manager.subscribe(() => {
                throw new Error(`Subscriber ${i} error during default state`);
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Create normal subscribers
            for (let i = 0; i < normalSubscriberCount; i++) {
              const unsubscribe = manager.subscribe((state: SystemState) => {
                normalSubscriberStates.push({ ...state });
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Process any batched updates
            vi.advanceTimersByTime(20);

            // Resilience property: Normal subscribers should still receive default state
            expect(normalSubscriberStates.length).toBe(normalSubscriberCount);

            // Verify all normal subscribers received valid default states
            normalSubscriberStates.forEach(state => {
              expect(isSystemState(state)).toBe(true);
              expect(state.systemStatus.powerMode).toBe('IDLE');
              expect(state.intruders).toEqual([]);
              expect(state.alerts.alertLevel).toBe('NORMAL');
              expect(state.videoStatus.isLive).toBe(false);
              expect(state.metadata.connectionStatus).toBe('disconnected');
            });

            // Error isolation property: System should continue functioning despite subscriber errors
            expect(() => {
              // This should not throw despite error subscribers
              manager.updateState({ 
                systemStatus: { 
                  powerMode: 'ACTIVE',
                  powerConsumption: 100,
                  batteryRemaining: 300,
                  fps: 30,
                  processingStatus: 'Active',
                  cameraStatus: 'Connected',
                  timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
                } 
              });
              vi.advanceTimersByTime(20);
            }).not.toThrow();

            // Verify normal subscribers received the update
            const updatedStates = normalSubscriberStates.filter(state => state.systemStatus.powerMode === 'ACTIVE');
            expect(updatedStates.length).toBe(normalSubscriberCount);

            // Cleanup
            unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide default state that allows components to render without errors', () => {
      fc.assert(
        fc.property(
          fc.constant(true), // Always test this property
          () => {
            const receivedStates: SystemState[] = [];
            
            const unsubscribe = manager.subscribe((state: SystemState) => {
              receivedStates.push({ ...state });
            });

            // Process any batched updates
            vi.advanceTimersByTime(20);

            expect(receivedStates.length).toBeGreaterThan(0);
            const defaultState = receivedStates[0];

            // Component compatibility property: Default state should be safe for all components
            
            // SystemStatus component requirements
            expect(typeof defaultState.systemStatus.powerMode).toBe('string');
            expect(typeof defaultState.systemStatus.powerConsumption).toBe('number');
            expect(typeof defaultState.systemStatus.batteryRemaining).toBe('number');
            expect(typeof defaultState.systemStatus.fps).toBe('number');
            expect(typeof defaultState.systemStatus.processingStatus).toBe('string');
            expect(typeof defaultState.systemStatus.cameraStatus).toBe('string');
            expect(typeof defaultState.systemStatus.timestamp).toBe('string');

            // IntruderList component requirements
            expect(Array.isArray(defaultState.intruders)).toBe(true);
            defaultState.intruders.forEach(intruder => {
              expect(isIntruderData(intruder)).toBe(true);
            });

            // ThreatIntelligence component requirements
            expect(typeof defaultState.threatIntelligence).toBe('object');
            expect(defaultState.threatIntelligence).not.toBeNull();

            // AlertsPanel component requirements
            expect(typeof defaultState.alerts).toBe('object');
            expect(typeof defaultState.alerts.alertLevel).toBe('string');
            expect(typeof defaultState.alerts.recommendation).toBe('string');
            expect(Array.isArray(defaultState.alerts.recentAlerts)).toBe(true);

            // VideoFeed component requirements
            expect(typeof defaultState.videoStatus).toBe('object');
            expect(typeof defaultState.videoStatus.isLive).toBe('boolean');
            expect(typeof defaultState.videoStatus.resolution).toBe('string');
            expect(typeof defaultState.videoStatus.latency).toBe('number');
            expect(typeof defaultState.videoStatus.source).toBe('string');

            // Metadata requirements
            expect(typeof defaultState.metadata).toBe('object');
            expect(typeof defaultState.metadata.lastUpdated).toBe('string');
            expect(typeof defaultState.metadata.connectionStatus).toBe('string');
            expect(typeof defaultState.metadata.dataSource).toBe('string');

            // Safe values property: No undefined or null values in critical paths
            expect(defaultState.systemStatus.powerMode).not.toBeNull();
            expect(defaultState.systemStatus.powerMode).not.toBeUndefined();
            expect(defaultState.alerts.alertLevel).not.toBeNull();
            expect(defaultState.alerts.alertLevel).not.toBeUndefined();
            expect(defaultState.videoStatus.source).not.toBeNull();
            expect(defaultState.videoStatus.source).not.toBeUndefined();

            unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});