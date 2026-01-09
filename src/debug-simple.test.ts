import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AeroVisionService } from './app/services/aeroVisionService';

describe('Debug AeroVisionService', () => {
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

  it('should call subscriber when refresh is called with complex data', async () => {
    // Complex test data similar to property test
    const testData = {
      system: {
        power_mode: 'ACTIVE' as const,
        power_w: 100.5,
        battery_minutes: 300,
        fps: 30.2,
        camera_status: 'CONNECTED' as const,
        processing_status: 'Active processing',
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
      },
      tracks: [{
        id: 1,
        zone: 'RESTRICTED' as const,
        threat_score: 75,
        threat_level: 'HIGH' as const,
        detection_time: 120,
        behavior: {
          loitering: {
            active: true,
            duration: 60
          },
          speed_anomaly: false,
          trajectory_confidence: 0.85,
          trajectory_stability: 'stable' as const
        },
        prediction: {
          near: { zone: 'CRITICAL', confidence: 0.9 },
          medium: { zone: 'RESTRICTED', confidence: 0.7 },
          far: { zone: 'BUFFER', confidence: 0.5 },
          will_enter_restricted: true,
          overall_confidence: 0.8
        },
        explanation: [
          { factor: 'Speed', points: 10 },
          { factor: 'Direction', points: 15 }
        ]
      }],
      alerts: [{
        id: 'alert-1',
        time: new Date().toISOString(),
        message: 'High threat detected',
        level: 'CRITICAL' as const,
        track_id: 1
      }],
      video: {
        is_live: true,
        resolution: { width: 1920, height: 1080 },
        latency_ms: 50,
        source: 'webcam' as const,
        stream_url: 'http://localhost:8080/stream',
        frame_rate: 30,
        bitrate_kbps: 5000
      },
      timestamp: new Date().toISOString()
    };

    // Setup mock fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        timestamp: new Date().toISOString(),
        data: testData,
        version: '1.0.0'
      })
    });

    // Test subscriber
    let callCount = 0;
    const unsubscribe = service.subscribe((data) => {
      console.log('Subscriber called:', callCount++, data);
    });

    // Clear initial subscription call
    callCount = 0;

    // Test refresh
    console.log('Starting refresh with complex data...');
    const result = await service.refresh();
    console.log('Refresh result:', result ? 'success' : 'null');
    console.log('Final call count:', callCount);

    expect(callCount).toBe(1);
    expect(result).toBeTruthy();
    
    unsubscribe();
  });

  it('should handle multiple refresh calls like property test', async () => {
    // Array of test data like property test
    const pythonDataSequence = [
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
          processing_status: 'Alert mode',
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

    const receivedUpdates: any[] = [];
    let callbackCount = 0;
    
    // Subscribe to service updates
    const unsubscribe = service.subscribe((data: any) => {
      receivedUpdates.push({ ...data });
      callbackCount++;
    });

    // Clear initial subscription call (if any)
    receivedUpdates.length = 0;
    callbackCount = 0;

    // Setup mock fetch to return sequential data
    let fetchCallCount = 0;
    mockFetch.mockImplementation(() => {
      const dataIndex = fetchCallCount % pythonDataSequence.length;
      const pythonData = pythonDataSequence[dataIndex];
      fetchCallCount++;
      
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
      refreshPromises.push(service.refresh());
    }

    // Wait for all refreshes to complete
    const results = await Promise.all(refreshPromises);
    
    // Add a small delay to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 10));

    console.log('Results:', results.map(r => r ? 'success' : 'null'));
    console.log('Callback count:', callbackCount);
    console.log('Expected count:', pythonDataSequence.length);
    console.log('Received updates count:', receivedUpdates.length);

    // Core Property: High-frequency handling - each refresh should be processed
    expect(callbackCount).toBe(pythonDataSequence.length);
    expect(receivedUpdates.length).toBe(pythonDataSequence.length);
    
    unsubscribe();
  });
});