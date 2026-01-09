import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AeroVisionService } from './app/services/aeroVisionService';

describe('Debug Concurrent Calls', () => {
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

  it('should handle concurrent refresh calls correctly', async () => {
    const testData = [
      {
        system: {
          power_mode: 'ACTIVE' as const,
          power_w: 100,
          battery_minutes: 300,
          fps: 30,
          camera_status: 'CONNECTED' as const,
          processing_status: 'Active',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        },
        tracks: [],
        alerts: [],
        timestamp: new Date().toISOString()
      },
      {
        system: {
          power_mode: 'ALERT' as const,
          power_w: 150,
          battery_minutes: 250,
          fps: 25,
          camera_status: 'CONNECTED' as const,
          processing_status: 'Alert',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        },
        tracks: [],
        alerts: [],
        timestamp: new Date().toISOString()
      },
      {
        system: {
          power_mode: 'IDLE' as const,
          power_w: 50,
          battery_minutes: 400,
          fps: 15,
          camera_status: 'CONNECTED' as const,
          processing_status: 'Idle',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        },
        tracks: [],
        alerts: [],
        timestamp: new Date().toISOString()
      }
    ];

    let callbackCount = 0;
    const receivedData: any[] = [];
    
    // Subscribe to service updates
    const unsubscribe = service.subscribe((data: any) => {
      console.log(`Callback ${callbackCount++}:`, data.system.power_mode);
      receivedData.push(data);
    });

    // Clear initial subscription call
    callbackCount = 0;
    receivedData.length = 0;

    // Setup mock fetch
    let fetchCallCount = 0;
    mockFetch.mockImplementation(() => {
      const currentCallIndex = fetchCallCount;
      fetchCallCount++;
      const dataIndex = currentCallIndex % testData.length;
      const pythonData = testData[dataIndex];
      
      console.log(`Mock fetch call ${currentCallIndex}, returning data index ${dataIndex}:`, pythonData.system.power_mode);
      
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

    console.log('=== Testing concurrent calls ===');
    
    // Test concurrent calls
    const refreshPromises: Promise<any>[] = [];
    for (let i = 0; i < testData.length; i++) {
      console.log(`Starting refresh ${i}`);
      refreshPromises.push(service.refresh());
    }

    console.log('Waiting for all promises to resolve...');
    const results = await Promise.all(refreshPromises);
    
    console.log('All promises resolved, results:', results.map(r => r ? r.system.power_mode : 'null'));
    
    // Add a small delay to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 50));

    console.log(`Final callback count: ${callbackCount}`);
    console.log(`Expected callback count: ${testData.length}`);
    console.log(`Received data count: ${receivedData.length}`);

    expect(callbackCount).toBe(testData.length);
    expect(receivedData.length).toBe(testData.length);
    
    unsubscribe();
  });

  it('should handle sequential refresh calls correctly', async () => {
    const testData = [
      {
        system: {
          power_mode: 'ACTIVE' as const,
          power_w: 100,
          battery_minutes: 300,
          fps: 30,
          camera_status: 'CONNECTED' as const,
          processing_status: 'Active',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        },
        tracks: [],
        alerts: [],
        timestamp: new Date().toISOString()
      },
      {
        system: {
          power_mode: 'ALERT' as const,
          power_w: 150,
          battery_minutes: 250,
          fps: 25,
          camera_status: 'CONNECTED' as const,
          processing_status: 'Alert',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        },
        tracks: [],
        alerts: [],
        timestamp: new Date().toISOString()
      },
      {
        system: {
          power_mode: 'IDLE' as const,
          power_w: 50,
          battery_minutes: 400,
          fps: 15,
          camera_status: 'CONNECTED' as const,
          processing_status: 'Idle',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        },
        tracks: [],
        alerts: [],
        timestamp: new Date().toISOString()
      }
    ];

    let callbackCount = 0;
    const receivedData: any[] = [];
    
    // Subscribe to service updates
    const unsubscribe = service.subscribe((data: any) => {
      console.log(`Sequential callback ${callbackCount++}:`, data.system.power_mode);
      receivedData.push(data);
    });

    // Clear initial subscription call
    callbackCount = 0;
    receivedData.length = 0;

    // Setup mock fetch
    let fetchCallCount = 0;
    mockFetch.mockImplementation(() => {
      const currentCallIndex = fetchCallCount;
      fetchCallCount++;
      const dataIndex = currentCallIndex % testData.length;
      const pythonData = testData[dataIndex];
      
      console.log(`Sequential mock fetch call ${currentCallIndex}, returning data index ${dataIndex}:`, pythonData.system.power_mode);
      
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

    console.log('=== Testing sequential calls ===');
    
    // Test sequential calls
    for (let i = 0; i < testData.length; i++) {
      console.log(`Starting sequential refresh ${i}`);
      const result = await service.refresh();
      console.log(`Sequential refresh ${i} completed:`, result ? result.system.power_mode : 'null');
    }

    console.log(`Final sequential callback count: ${callbackCount}`);
    console.log(`Expected sequential callback count: ${testData.length}`);
    console.log(`Received sequential data count: ${receivedData.length}`);

    expect(callbackCount).toBe(testData.length);
    expect(receivedData.length).toBe(testData.length);
    
    unsubscribe();
  });
});