// SystemStateManager Property-Based Tests
// Property tests for state update propagation and system state management

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SystemStateManager } from '../systemStateManager';
import { 
  SystemState, 
  SystemStatusData, 
  IntruderData, 
  ThreatIntelligenceData, 
  AlertsData, 
  VideoStatusData,
  DEFAULT_SYSTEM_STATE 
} from '../../types/systemState';

describe('SystemStateManager Property Tests', () => {
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

  // Property 2: State Update Propagation
  // **Feature: aerovision-dashboard-integration, Property 2: State Update Propagation**
  describe('Property 2: State Update Propagation', () => {
    it('should propagate all state updates to all subscribers', () => {
      fc.assert(
        fc.property(
          // Generator for partial system state updates
          fc.record({
            systemStatus: fc.option(fc.record({
              powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
              powerConsumption: fc.nat({ max: 1000 }),
              batteryRemaining: fc.nat({ max: 600 }),
              fps: fc.nat({ max: 60 }),
              processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
              cameraStatus: fc.constantFrom('Connected', 'Lost'),
              timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
            })),
            intruders: fc.option(fc.array(
              fc.record({
                trackId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `TRK-${s.padStart(3, '0')}`),
                zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                threatScore: fc.nat({ max: 100 }),
                threatLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                timeSinceDetection: fc.nat({ max: 3600 })
              }),
              { maxLength: 10 }
            )),
            threatIntelligence: fc.option(fc.dictionary(
              fc.string({ minLength: 1, maxLength: 10 }).map(s => `TRK-${s.padStart(3, '0')}`),
              fc.record({
                threatBreakdown: fc.array(
                  fc.record({
                    factor: fc.string({ minLength: 1, maxLength: 30 }),
                    score: fc.integer({ min: -50, max: 50 })
                  }),
                  { maxLength: 5 }
                ),
                behavioral: fc.record({
                  loitering: fc.boolean(),
                  loiteringDuration: fc.option(fc.nat({ max: 3600 })),
                  speedAnomaly: fc.boolean(),
                  trajectoryStability: fc.constantFrom('Stable', 'Moderate', 'Erratic'),
                  trajectoryConfidence: fc.nat({ max: 100 })
                }),
                prediction: fc.record({
                  nearTerm: fc.string({ minLength: 1, maxLength: 100 }),
                  mediumTerm: fc.string({ minLength: 1, maxLength: 100 }),
                  farTerm: fc.string({ minLength: 1, maxLength: 100 }),
                  confidence: fc.constantFrom('High', 'Medium', 'Low'),
                  willEnterRestricted: fc.boolean()
                })
              })
            )),
            alerts: fc.option(fc.record({
              alertLevel: fc.constantFrom('NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL'),
              recommendation: fc.string({ minLength: 1, maxLength: 200 }),
              recentAlerts: fc.array(
                fc.record({
                  id: fc.string({ minLength: 1, maxLength: 20 }),
                  timestamp: fc.string().map(() => new Date().toISOString()),
                  message: fc.string({ minLength: 1, maxLength: 100 }),
                  type: fc.constantFrom('info', 'warning', 'critical')
                }),
                { maxLength: 20 }
              )
            })),
            videoStatus: fc.option(fc.record({
              isLive: fc.boolean(),
              resolution: fc.string({ minLength: 1, maxLength: 20 }),
              latency: fc.nat({ max: 5000 }),
              source: fc.constantFrom('webcam', 'drone', 'placeholder'),
              streamUrl: fc.option(fc.webUrl()),
              frameRate: fc.option(fc.nat({ min: 1, max: 120 })),
              bitrate: fc.option(fc.nat({ min: 100, max: 50000 }))
            }))
          }),
          (partialUpdate: Partial<SystemState>) => {
            // Track all subscriber calls
            const subscriberCalls: SystemState[][] = [];
            const subscriberCount = fc.sample(fc.nat({ min: 1, max: 5 }), 1)[0];
            
            // Create multiple subscribers
            const unsubscribeFunctions: (() => void)[] = [];
            for (let i = 0; i < subscriberCount; i++) {
              subscriberCalls[i] = [];
              const unsubscribe = manager.subscribe((state: SystemState) => {
                subscriberCalls[i].push({ ...state });
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Clear initial subscription calls (each subscriber gets current state immediately)
            subscriberCalls.forEach(calls => calls.length = 0);

            // Apply the update
            manager.updateState(partialUpdate);

            // Process batched updates
            vi.advanceTimersByTime(20);

            // Verify all subscribers received the update
            subscriberCalls.forEach((calls, index) => {
              expect(calls.length).toBeGreaterThan(0);
              
              // Get the latest state received by this subscriber
              const latestState = calls[calls.length - 1];
              
              // Verify the update was applied
              if (partialUpdate.systemStatus) {
                expect(latestState.systemStatus).toMatchObject(partialUpdate.systemStatus);
              }
              if (partialUpdate.intruders) {
                expect(latestState.intruders).toEqual(partialUpdate.intruders);
              }
              if (partialUpdate.threatIntelligence) {
                expect(latestState.threatIntelligence).toMatchObject(partialUpdate.threatIntelligence);
              }
              if (partialUpdate.alerts) {
                expect(latestState.alerts).toMatchObject(partialUpdate.alerts);
              }
              if (partialUpdate.videoStatus) {
                expect(latestState.videoStatus).toMatchObject(partialUpdate.videoStatus);
              }

              // Verify metadata was updated
              expect(latestState.metadata.lastUpdated).toBeTruthy();
              expect(new Date(latestState.metadata.lastUpdated)).toBeInstanceOf(Date);
            });

            // Verify all subscribers received the same state
            if (subscriberCount > 1) {
              const firstSubscriberState = subscriberCalls[0][subscriberCalls[0].length - 1];
              for (let i = 1; i < subscriberCount; i++) {
                const otherSubscriberState = subscriberCalls[i][subscriberCalls[i].length - 1];
                expect(otherSubscriberState).toEqual(firstSubscriberState);
              }
            }

            // Cleanup
            unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should propagate updates even when subscribers throw errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            systemStatus: fc.record({
              powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
              powerConsumption: fc.nat({ max: 1000 }),
              batteryRemaining: fc.nat({ max: 600 }),
              fps: fc.nat({ max: 60 }),
              processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
              cameraStatus: fc.constantFrom('Connected', 'Lost'),
              timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
            })
          }),
          fc.nat({ min: 1, max: 3 }), // Number of error-throwing subscribers
          fc.nat({ min: 1, max: 3 }), // Number of normal subscribers
          (update: Partial<SystemState>, errorSubscriberCount: number, normalSubscriberCount: number) => {
            const normalSubscriberCalls: SystemState[] = [];
            const unsubscribeFunctions: (() => void)[] = [];

            // Create error-throwing subscribers
            for (let i = 0; i < errorSubscriberCount; i++) {
              const unsubscribe = manager.subscribe(() => {
                throw new Error(`Subscriber ${i} error`);
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Create normal subscribers
            for (let i = 0; i < normalSubscriberCount; i++) {
              const unsubscribe = manager.subscribe((state: SystemState) => {
                normalSubscriberCalls.push({ ...state });
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Clear initial subscription calls
            normalSubscriberCalls.length = 0;

            // Apply update - should not throw despite error subscribers
            expect(() => {
              manager.updateState(update);
              vi.advanceTimersByTime(20);
            }).not.toThrow();

            // Verify normal subscribers still received updates
            expect(normalSubscriberCalls.length).toBe(normalSubscriberCount);

            // Verify the update was applied correctly
            normalSubscriberCalls.forEach(state => {
              if (update.systemStatus) {
                expect(state.systemStatus).toMatchObject(update.systemStatus);
              }
            });

            // Cleanup
            unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain state consistency across rapid sequential updates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              systemStatus: fc.option(fc.record({
                powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                powerConsumption: fc.nat({ max: 1000 }),
                batteryRemaining: fc.nat({ max: 600 }),
                fps: fc.nat({ max: 60 }),
                processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
                cameraStatus: fc.constantFrom('Connected', 'Lost'),
                timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
              })),
              intruders: fc.option(fc.array(
                fc.record({
                  trackId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `TRK-${s.padStart(3, '0')}`),
                  zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                  threatScore: fc.nat({ max: 100 }),
                  threatLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                  timeSinceDetection: fc.nat({ max: 3600 })
                }),
                { maxLength: 5 }
              ))
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (updates: Partial<SystemState>[]) => {
            const subscriberStates: SystemState[] = [];
            
            const unsubscribe = manager.subscribe((state: SystemState) => {
              subscriberStates.push({ ...state });
            });

            // Clear initial subscription call
            subscriberStates.length = 0;

            // Apply all updates rapidly
            updates.forEach(update => {
              manager.updateState(update);
            });

            // Process all batched updates
            vi.advanceTimersByTime(20);

            // Should have received at least one update
            expect(subscriberStates.length).toBeGreaterThan(0);

            // Get the final state
            const finalState = subscriberStates[subscriberStates.length - 1];

            // Verify state structure is always valid
            expect(finalState).toHaveProperty('systemStatus');
            expect(finalState).toHaveProperty('intruders');
            expect(finalState).toHaveProperty('threatIntelligence');
            expect(finalState).toHaveProperty('alerts');
            expect(finalState).toHaveProperty('videoStatus');
            expect(finalState).toHaveProperty('metadata');

            expect(Array.isArray(finalState.intruders)).toBe(true);
            expect(Array.isArray(finalState.alerts.recentAlerts)).toBe(true);
            expect(typeof finalState.threatIntelligence).toBe('object');

            // Verify metadata was updated
            expect(finalState.metadata.lastUpdated).toBeTruthy();
            expect(new Date(finalState.metadata.lastUpdated)).toBeInstanceOf(Date);

            unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle subscriber unsubscription during updates', () => {
      fc.assert(
        fc.property(
          fc.record({
            systemStatus: fc.record({
              powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
              powerConsumption: fc.nat({ max: 1000 }),
              batteryRemaining: fc.nat({ max: 600 }),
              fps: fc.nat({ max: 60 }),
              processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
              cameraStatus: fc.constantFrom('Connected', 'Lost'),
              timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
            })
          }),
          fc.nat({ min: 2, max: 5 }), // Number of subscribers
          (update: Partial<SystemState>, subscriberCount: number) => {
            const subscriberCalls: SystemState[][] = [];
            const unsubscribeFunctions: (() => void)[] = [];

            // Create subscribers
            for (let i = 0; i < subscriberCount; i++) {
              subscriberCalls[i] = [];
              const unsubscribe = manager.subscribe((state: SystemState) => {
                subscriberCalls[i].push({ ...state });
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Clear initial subscription calls
            subscriberCalls.forEach(calls => calls.length = 0);

            // Unsubscribe half of the subscribers
            const unsubscribeCount = Math.floor(subscriberCount / 2);
            for (let i = 0; i < unsubscribeCount; i++) {
              unsubscribeFunctions[i]();
            }

            // Apply update
            manager.updateState(update);
            vi.advanceTimersByTime(20);

            // Verify only remaining subscribers received updates
            for (let i = 0; i < subscriberCount; i++) {
              if (i < unsubscribeCount) {
                // Unsubscribed - should not receive updates
                expect(subscriberCalls[i].length).toBe(0);
              } else {
                // Still subscribed - should receive updates
                expect(subscriberCalls[i].length).toBeGreaterThan(0);
                const latestState = subscriberCalls[i][subscriberCalls[i].length - 1];
                expect(latestState.systemStatus).toMatchObject(update.systemStatus!);
              }
            }

            // Cleanup remaining subscribers
            for (let i = unsubscribeCount; i < subscriberCount; i++) {
              unsubscribeFunctions[i]();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 15: Update Batching for Performance
  // **Feature: aerovision-dashboard-integration, Property 15: Update Batching for Performance**
  describe('Property 15: Update Batching for Performance', () => {
    it('should batch multiple rapid updates to prevent excessive re-renders', () => {
      fc.assert(
        fc.property(
          // Generate a sequence of rapid updates
          fc.array(
            fc.record({
              systemStatus: fc.option(fc.record({
                powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                powerConsumption: fc.nat({ max: 1000 }),
                batteryRemaining: fc.nat({ max: 600 }),
                fps: fc.nat({ max: 60 }),
                processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
                cameraStatus: fc.constantFrom('Connected', 'Lost'),
                timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
              })),
              intruders: fc.option(fc.array(
                fc.record({
                  trackId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `TRK-${s.padStart(3, '0')}`),
                  zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                  threatScore: fc.nat({ max: 100 }),
                  threatLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                  timeSinceDetection: fc.nat({ max: 3600 })
                }),
                { maxLength: 5 }
              )),
              videoStatus: fc.option(fc.record({
                isLive: fc.boolean(),
                resolution: fc.string({ minLength: 1, maxLength: 20 }),
                latency: fc.nat({ max: 5000 }),
                source: fc.constantFrom('webcam', 'drone', 'placeholder'),
                streamUrl: fc.option(fc.webUrl())
              }))
            }),
            { minLength: 3, maxLength: 10 } // Multiple rapid updates
          ),
          fc.nat({ min: 1, max: 3 }), // Number of subscribers
          (updates: Partial<SystemState>[], subscriberCount: number) => {
            const subscriberCallCounts: number[] = [];
            const subscriberStates: SystemState[][] = [];
            const unsubscribeFunctions: (() => void)[] = [];

            // Create subscribers to track call frequency
            for (let i = 0; i < subscriberCount; i++) {
              subscriberCallCounts[i] = 0;
              subscriberStates[i] = [];
              
              const unsubscribe = manager.subscribe((state: SystemState) => {
                subscriberCallCounts[i]++;
                subscriberStates[i].push({ ...state });
              });
              unsubscribeFunctions.push(unsubscribe);
            }

            // Clear initial subscription calls
            subscriberCallCounts.fill(0);
            subscriberStates.forEach(states => states.length = 0);

            // Apply all updates rapidly (within the batch window)
            updates.forEach(update => {
              manager.updateState(update);
            });

            // Process batched updates
            vi.advanceTimersByTime(20);

            // Core batching property: should have significantly fewer subscriber calls than updates
            subscriberCallCounts.forEach(callCount => {
              // With batching, we should have much fewer calls than the number of updates
              // In ideal batching, we should have exactly 1 call regardless of update count
              expect(callCount).toBeLessThanOrEqual(Math.ceil(updates.length / 2));
              expect(callCount).toBeGreaterThan(0); // But should have at least one call
            });

            // Consistency property: all subscribers received the same number of calls
            if (subscriberCount > 1) {
              const firstSubscriberCallCount = subscriberCallCounts[0];
              subscriberCallCounts.forEach(callCount => {
                expect(callCount).toBe(firstSubscriberCallCount);
              });
            }

            // State integrity property: final state is always valid
            subscriberStates.forEach(states => {
              if (states.length > 0) {
                const finalState = states[states.length - 1];
                
                // Verify state structure is always valid
                expect(finalState).toHaveProperty('systemStatus');
                expect(finalState).toHaveProperty('intruders');
                expect(finalState).toHaveProperty('threatIntelligence');
                expect(finalState).toHaveProperty('alerts');
                expect(finalState).toHaveProperty('videoStatus');
                expect(finalState).toHaveProperty('metadata');

                expect(Array.isArray(finalState.intruders)).toBe(true);
                expect(Array.isArray(finalState.alerts.recentAlerts)).toBe(true);
                expect(typeof finalState.threatIntelligence).toBe('object');

                // Verify metadata was updated
                expect(finalState.metadata.lastUpdated).toBeTruthy();
                expect(new Date(finalState.metadata.lastUpdated)).toBeInstanceOf(Date);
              }
            });

            // Performance property: batching reduces update frequency
            const totalUpdates = updates.length;
            const totalSubscriberCalls = subscriberCallCounts.reduce((sum, count) => sum + count, 0);
            
            // Only check performance if we have subscribers
            if (subscriberCount > 0) {
              const averageCallsPerSubscriber = totalSubscriberCalls / subscriberCount;
              // Batching should result in fewer calls than updates
              expect(averageCallsPerSubscriber).toBeLessThan(totalUpdates);
            }

            // Cleanup
            unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain performance under high-frequency update scenarios', () => {
      fc.assert(
        fc.property(
          // Generate high-frequency updates (simulating 10Hz updates)
          fc.array(
            fc.record({
              systemStatus: fc.record({
                powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                powerConsumption: fc.nat({ max: 1000 }),
                batteryRemaining: fc.nat({ max: 600 }),
                fps: fc.nat({ max: 60 }),
                processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
                cameraStatus: fc.constantFrom('Connected', 'Lost'),
                timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
              })
            }),
            { minLength: 10, maxLength: 20 } // High frequency updates
          ),
          (updates: Partial<SystemState>[]) => {
            const subscriberCallTimes: number[] = [];
            let totalProcessingTime = 0;
            
            const unsubscribe = manager.subscribe((state: SystemState) => {
              subscriberCallTimes.push(Date.now());
            });

            // Clear initial subscription call
            subscriberCallTimes.length = 0;

            const startTime = Date.now();

            // Apply updates rapidly
            updates.forEach((update, index) => {
              manager.updateState(update);
              // Simulate small time gaps between updates (100ms = 10Hz)
              vi.advanceTimersByTime(1);
            });

            // Process all batched updates
            vi.advanceTimersByTime(20);

            totalProcessingTime = Date.now() - startTime;

            // Verify performance characteristics
            expect(subscriberCallTimes.length).toBeGreaterThan(0);
            expect(subscriberCallTimes.length).toBeLessThanOrEqual(updates.length);

            // Verify batching reduced the number of subscriber notifications
            // With proper batching, we should have significantly fewer calls than updates
            const batchingEfficiency = subscriberCallTimes.length / updates.length;
            expect(batchingEfficiency).toBeLessThan(1.0); // Should be less than 1:1 ratio

            // Verify the system can handle the update frequency without excessive delay
            // This is a performance characteristic test
            const averageUpdateTime = totalProcessingTime / updates.length;
            expect(averageUpdateTime).toBeLessThan(50); // Should process each update in less than 50ms

            unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should batch updates while preserving update order and data integrity', () => {
      fc.assert(
        fc.property(
          // Generate sequential updates with different data types
          fc.array(
            fc.oneof(
              fc.record({
                systemStatus: fc.record({
                  powerConsumption: fc.nat({ max: 1000 }),
                  fps: fc.nat({ max: 60 }),
                  powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                  batteryRemaining: fc.nat({ max: 600 }),
                  processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
                  cameraStatus: fc.constantFrom('Connected', 'Lost'),
                  timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
                })
              }),
              fc.record({
                intruders: fc.array(
                  fc.record({
                    trackId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `TRK-${s.padStart(3, '0')}`),
                    zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                    threatScore: fc.nat({ max: 100 }),
                    threatLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                    timeSinceDetection: fc.nat({ max: 3600 })
                  }),
                  { maxLength: 3 }
                )
              }),
              fc.record({
                videoStatus: fc.record({
                  isLive: fc.boolean(),
                  resolution: fc.string({ minLength: 1, maxLength: 20 }),
                  latency: fc.nat({ max: 5000 }),
                  source: fc.constantFrom('webcam', 'drone', 'placeholder')
                })
              })
            ),
            { minLength: 5, maxLength: 15 }
          ),
          (updates: Partial<SystemState>[]) => {
            const receivedStates: SystemState[] = [];
            
            const unsubscribe = manager.subscribe((state: SystemState) => {
              receivedStates.push({ ...state });
            });

            // Clear initial subscription call
            receivedStates.length = 0;

            // Apply updates rapidly
            updates.forEach(update => {
              manager.updateState(update);
            });

            // Process batched updates
            vi.advanceTimersByTime(20);

            // Should have received at least one batched update
            expect(receivedStates.length).toBeGreaterThan(0);

            // Verify final state contains the last update of each type
            const finalState = receivedStates[receivedStates.length - 1];

            // Find the last non-null update for each property type
            const lastSystemStatusUpdate = updates.slice().reverse().find(u => u.systemStatus !== null && u.systemStatus !== undefined);
            const lastIntrudersUpdate = updates.slice().reverse().find(u => u.intruders !== null && u.intruders !== undefined);
            const lastVideoStatusUpdate = updates.slice().reverse().find(u => u.videoStatus !== null && u.videoStatus !== undefined);

            // Verify the final state reflects the last update of each type (proper merging)
            if (lastSystemStatusUpdate?.systemStatus) {
              expect(finalState.systemStatus).toMatchObject(lastSystemStatusUpdate.systemStatus);
            }
            if (lastIntrudersUpdate?.intruders) {
              expect(finalState.intruders).toEqual(lastIntrudersUpdate.intruders);
            }
            if (lastVideoStatusUpdate?.videoStatus) {
              expect(finalState.videoStatus).toMatchObject(lastVideoStatusUpdate.videoStatus);
            }

            // Verify state structure integrity
            expect(finalState).toHaveProperty('systemStatus');
            expect(finalState).toHaveProperty('intruders');
            expect(finalState).toHaveProperty('threatIntelligence');
            expect(finalState).toHaveProperty('alerts');
            expect(finalState).toHaveProperty('videoStatus');
            expect(finalState).toHaveProperty('metadata');

            // Verify metadata was updated
            expect(finalState.metadata.lastUpdated).toBeTruthy();
            expect(new Date(finalState.metadata.lastUpdated)).toBeInstanceOf(Date);

            unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mixed update frequencies without performance degradation', () => {
      fc.assert(
        fc.property(
          fc.record({
            rapidUpdates: fc.array(
              fc.record({
                systemStatus: fc.record({
                  fps: fc.nat({ max: 60 }),
                  powerConsumption: fc.nat({ max: 1000 }),
                  powerMode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
                  batteryRemaining: fc.nat({ max: 600 }),
                  processingStatus: fc.string({ minLength: 1, maxLength: 50 }),
                  cameraStatus: fc.constantFrom('Connected', 'Lost'),
                  timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
                })
              }),
              { minLength: 5, maxLength: 10 }
            ),
            slowUpdates: fc.array(
              fc.record({
                intruders: fc.array(
                  fc.record({
                    trackId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `TRK-${s.padStart(3, '0')}`),
                    zone: fc.constantFrom('PUBLIC', 'BUFFER', 'RESTRICTED', 'CRITICAL'),
                    threatScore: fc.nat({ max: 100 }),
                    threatLevel: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
                    timeSinceDetection: fc.nat({ max: 3600 })
                  }),
                  { maxLength: 3 }
                )
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          ({ rapidUpdates, slowUpdates }) => {
            const subscriberCalls: SystemState[] = [];
            
            const unsubscribe = manager.subscribe((state: SystemState) => {
              subscriberCalls.push({ ...state });
            });

            // Clear initial subscription call
            subscriberCalls.length = 0;

            // Apply rapid updates first
            rapidUpdates.forEach(update => {
              manager.updateState(update);
            });

            // Process first batch
            vi.advanceTimersByTime(20);
            const callsAfterRapidUpdates = subscriberCalls.length;

            // Apply slower updates with gaps
            slowUpdates.forEach((update, index) => {
              manager.updateState(update);
              if (index < slowUpdates.length - 1) {
                vi.advanceTimersByTime(50); // Larger gaps between slow updates
              }
            });

            // Process final batch
            vi.advanceTimersByTime(20);
            const totalCalls = subscriberCalls.length;

            // Verify batching worked for rapid updates
            expect(callsAfterRapidUpdates).toBeLessThanOrEqual(Math.ceil(rapidUpdates.length / 2));
            expect(callsAfterRapidUpdates).toBeGreaterThan(0);

            // Verify system handled mixed frequencies
            expect(totalCalls).toBeGreaterThan(callsAfterRapidUpdates);
            expect(totalCalls).toBeLessThan(rapidUpdates.length + slowUpdates.length);

            // Verify final state integrity
            if (subscriberCalls.length > 0) {
              const finalState = subscriberCalls[subscriberCalls.length - 1];
              
              // Should have the last rapid update's system status
              const lastRapidUpdate = rapidUpdates[rapidUpdates.length - 1];
              expect(finalState.systemStatus).toMatchObject(lastRapidUpdate.systemStatus);

              // Should have the last slow update's intruders
              const lastSlowUpdate = slowUpdates[slowUpdates.length - 1];
              expect(finalState.intruders).toEqual(lastSlowUpdate.intruders);
            }

            unsubscribe();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});