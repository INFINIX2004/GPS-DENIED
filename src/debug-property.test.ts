import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AeroVisionService } from './app/services/aeroVisionService';

describe('Debug Property Test', () => {
  let service: AeroVisionService;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock WebSocket to force REST API fallback
    global.WebSocket = vi.fn().mockImplementation(() => {
      throw new Error('WebSocket unavailable - testing REST API');
    });
    
    service = new AeroVisionService(
      'ws://localhost:8080/test',
      'http://localhost:8080/test'
    );
  });

  it('should handle property test with simple data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            system: fc.record({
              power_mode: fc.constantFrom('IDLE', 'ACTIVE', 'ALERT'),
              power_w: fc.float({ min: 10, max: 1000 }),
              battery_minutes: fc.nat({ min: 1, max: 600 }),
              fps: fc.float({ min: 1, max: 60 }),
              camera_status: fc.constantFrom('CONNECTED', 'DISCONNECTED'),
              processing_status: fc.string({ minLength: 5, maxLength: 50 }),
              timestamp: fc.string().map(() => new Date().toLocaleTimeString('en-US', { hour12: false }))
            }),
            tracks: fc.constant([]),
            alerts: fc.constant([]),
            timestamp: fc.string().map(() => new Date().toISOString())
          }),
          { minLength: 3, maxLength: 5 }
        ),
        (pythonDataSequence: any[]) => {
          console.log(`\n=== Property test run with ${pythonDataSequence.length} items ===`);
          
          // Create a fresh service instance for each property test run
          const testService = new AeroVisionService(
            'ws://localhost:8080/test',
            'http://localhost:8080/test'
          );
          
          const receivedUpdates: any[] = [];
          let callbackCount = 0;
          
          // Subscribe to service updates
          const unsubscribe = testService.subscribe((data: any) => {
            console.log(`Property callback ${callbackCount++}:`, data.system.power_mode);
            receivedUpdates.push({ ...data });
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
            
            console.log(`Property mock fetch call ${currentCallIndex}, returning data index ${dataIndex}:`, pythonData.system.power_mode);
            
            const response = {
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
            console.log(`Starting property refresh ${i}`);
            refreshPromises.push(testService.refresh());
          }

          // Wait for all refreshes to complete
          return Promise.all(refreshPromises).then((results) => {
            console.log('Property promises resolved, results:', results.map(r => r ? r.system.power_mode : 'null'));
            
            // Add a small delay to ensure all async operations complete
            return new Promise(resolve => setTimeout(resolve, 10));
          }).then(() => {
            console.log(`Property final callback count: ${callbackCount}`);
            console.log(`Property expected callback count: ${pythonDataSequence.length}`);
            console.log(`Property received updates count: ${receivedUpdates.length}`);
            
            // Core Property: High-frequency handling - each refresh should be processed
            expect(callbackCount).toBe(pythonDataSequence.length);
            expect(receivedUpdates.length).toBe(pythonDataSequence.length);
            
            unsubscribe();
            testService.cleanup();
          });
        }
      ),
      { numRuns: 3, timeout: 5000 }
    );
  });
});