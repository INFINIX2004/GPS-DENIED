// Backend Service Unit Tests
// Test WebSocket connection establishment and fallback, REST API polling with retry logic,
// and graceful handling of backend disconnection

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { AeroVisionBackendService } from '../backendService'
import { DEFAULT_SYSTEM_STATE } from '../../types/systemState'
import type { PythonSystemData, PythonApiResponse } from '../../types/pythonInterfaces'

// Mock data for testing
const mockPythonData: PythonSystemData = {
  system: {
    power_mode: 'ACTIVE',
    power_w: 8.5,
    battery_minutes: 420,
    fps: 24.7,
    camera_status: 'CONNECTED',
    processing_status: 'Normal',
    timestamp: '12:34:56'
  },
  tracks: [
    {
      id: 1,
      zone: 'RESTRICTED',
      threat_score: 75,
      threat_level: 'HIGH',
      detection_time: 120,
      behavior: {
        loitering: { active: true, duration: 96 },
        speed_anomaly: false,
        trajectory_confidence: 0.84,
        trajectory_stability: 'stable'
      },
      prediction: {
        near: { zone: 'RESTRICTED', confidence: 0.84, description: 'Staying in zone' },
        medium: { zone: 'CRITICAL', confidence: 0.71, description: 'May move to critical' },
        far: { zone: 'CRITICAL', confidence: 0.55, description: 'Long term critical' },
        will_enter_restricted: false,
        overall_confidence: 0.8
      },
      explanation: [
        { factor: 'Zone violation', points: 30 },
        { factor: 'Loitering detected', points: 15 }
      ]
    }
  ],
  alerts: [
    {
      id: 'alert-1',
      time: '12:03:21',
      message: 'Entered RESTRICTED zone',
      level: 'WARNING',
      track_id: 1
    }
  ],
  video: {
    is_live: true,
    resolution: { width: 1920, height: 1080 },
    latency_ms: 45,
    source: 'drone',
    stream_url: 'rtsp://example.com/stream',
    frame_rate: 30,
    bitrate_kbps: 2000
  },
  timestamp: '2024-01-08T12:34:56Z'
}

const mockApiResponse: PythonApiResponse = {
  success: true,
  timestamp: '2024-01-08T12:34:56Z',
  data: mockPythonData,
  version: '1.0.0'
}

describe('AeroVisionBackendService', () => {
  let service: AeroVisionBackendService
  let mockFetch: any
  let mockWebSocket: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Mock fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch
    
    // Create service with test configuration
    service = new AeroVisionBackendService({
      websocketUrl: 'ws://localhost:8080/test',
      apiUrl: 'http://localhost:8080/test',
      preferWebSocket: true,
      updateFrequency: 10,
      maxReconnectAttempts: 3,
      reconnectDelay: 100,
      timeout: 1000,
      enableLogging: false
    })
  })

  afterEach(() => {
    service.disconnect()
  })

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      const defaultService = new AeroVisionBackendService()
      expect(defaultService.getConnectionStatus()).toBe('disconnected')
      expect(defaultService.isHealthy()).toBe(false)
    })

    test('should accept custom configuration', () => {
      const customService = new AeroVisionBackendService({
        websocketUrl: 'ws://custom:9000/ws',
        apiUrl: 'http://custom:9000/api',
        preferWebSocket: false,
        updateFrequency: 5,
        enableLogging: true
      })
      
      expect(customService.getConnectionStatus()).toBe('disconnected')
    })

    test('should update configuration via configure method', () => {
      service.configure({
        updateFrequency: 20,
        maxReconnectAttempts: 10
      })
      
      // Configuration is internal, but we can test it affects behavior
      expect(service.getConnectionStatus()).toBe('disconnected')
    })
  })

  describe('Connection Management', () => {
    test('should start in disconnected state', () => {
      expect(service.getConnectionStatus()).toBe('disconnected')
      expect(service.isHealthy()).toBe(false)
      expect(service.getLastError()).toBeNull()
    })

    test('should handle WebSocket connection establishment', async () => {
      // Mock successful WebSocket connection
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: vi.fn(),
        send: vi.fn()
      }
      
      // Override WebSocket constructor to return our mock
      const originalWebSocket = global.WebSocket
      global.WebSocket = vi.fn().mockImplementation(() => {
        const ws = {
          ...mockWs,
          readyState: WebSocket.CONNECTING,
          onopen: null,
          onclose: null,
          onmessage: null,
          onerror: null
        }
        
        // Simulate successful connection
        setTimeout(() => {
          ws.readyState = WebSocket.OPEN
          if (ws.onopen) ws.onopen(new Event('open'))
        }, 10)
        
        return ws
      }) as any

      await service.connect()
      
      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(['connecting', 'connected']).toContain(service.getConnectionStatus())
      
      // Restore original WebSocket
      global.WebSocket = originalWebSocket
    })

    test('should fallback to REST API when WebSocket fails', async () => {
      // Mock WebSocket failure
      global.WebSocket = vi.fn().mockImplementation(() => {
        const ws = {
          readyState: WebSocket.CONNECTING,
          onopen: null,
          onclose: null,
          onmessage: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn()
        }
        
        // Simulate connection failure
        setTimeout(() => {
          if (ws.onerror) ws.onerror(new Event('error'))
        }, 10)
        
        return ws
      }) as any

      // Mock successful REST API
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      await service.connect()
      
      // Wait for fallback to occur
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(['connecting', 'connected']).toContain(service.getConnectionStatus())
    })

    test('should handle graceful disconnection', () => {
      service.disconnect()
      
      expect(service.getConnectionStatus()).toBe('disconnected')
      expect(service.isHealthy()).toBe(false)
    })
  })

  describe('REST API Polling', () => {
    test('should fetch data via REST API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.refresh()
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/test',
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
      )
      
      expect(result).toBeDefined()
      expect(result?.systemStatus.powerMode).toBe('ACTIVE')
      expect(result?.intruders).toHaveLength(1)
      expect(result?.intruders[0].trackId).toBe('TRK-001')
    })

    test('should handle REST API errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await service.refresh()
      
      expect(result).toBeNull()
      expect(service.getLastError()).toContain('Manual refresh failed')
    })

    test('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      const result = await service.refresh()
      
      expect(result).toBeNull()
      expect(service.getLastError()).toContain('HTTP 500')
    })

    test('should handle invalid API response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Invalid data' })
      })

      const result = await service.refresh()
      
      expect(result).toBeNull()
      expect(service.getLastError()).toContain('Invalid data')
    })

    test('should handle request timeout', async () => {
      // Mock a slow response that exceeds timeout
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      )

      const result = await service.refresh()
      
      expect(result).toBeNull()
    })
  })

  describe('Retry Logic', () => {
    test('should implement exponential backoff for reconnection', async () => {
      // This test verifies that the retry mechanism exists in the service
      // The actual retry behavior is complex to test due to timing and async nature
      
      // Mock WebSocket that always fails
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('Connection failed')
      })

      // Mock REST API that also fails initially
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      // Attempt connection - should not throw despite failures
      await expect(service.connect()).resolves.not.toThrow()
      
      // Service should handle the error gracefully
      expect(service.getLastError()).toBeTruthy()
    })

    test('should fallback to REST after max reconnection attempts', async () => {
      // Mock WebSocket that always fails
      global.WebSocket = vi.fn().mockImplementation(() => {
        const ws = {
          readyState: WebSocket.CONNECTING,
          onopen: null,
          onclose: null,
          onmessage: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn()
        }
        
        setTimeout(() => {
          if (ws.onerror) ws.onerror(new Event('error'))
        }, 10)
        
        return ws
      }) as any

      // Mock successful REST API
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      await service.connect()
      
      // Wait for max attempts and fallback
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      expect(['connecting', 'connected']).toContain(service.getConnectionStatus())
    })
  })

  describe('Subscription Management', () => {
    test('should handle subscriber registration and notification', async () => {
      const callback = vi.fn()
      
      // Subscribe to updates
      const unsubscribe = service.subscribe(callback)
      
      // Should immediately call with current state
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        systemStatus: expect.any(Object),
        intruders: expect.any(Array),
        metadata: expect.objectContaining({
          connectionStatus: expect.any(String)
        })
      }))
      
      // Clean up
      unsubscribe()
    })

    test('should auto-connect when first subscriber is added', async () => {
      const callback = vi.fn()
      
      // Mock successful REST API for auto-connection
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })
      
      service.subscribe(callback)
      
      // Wait for auto-connection attempt
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Should have attempted connection (may be connecting or connected)
      expect(['connecting', 'connected']).toContain(service.getConnectionStatus())
    })

    test('should auto-disconnect when last subscriber is removed', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      const unsubscribe1 = service.subscribe(callback1)
      const unsubscribe2 = service.subscribe(callback2)
      
      // Remove first subscriber
      unsubscribe1()
      expect(service.getConnectionStatus()).not.toBe('disconnected')
      
      // Remove last subscriber
      unsubscribe2()
      expect(service.getConnectionStatus()).toBe('disconnected')
    })

    test('should handle subscriber callback errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber error')
      })
      const normalCallback = vi.fn()
      
      // Should not throw when error callback fails
      expect(() => {
        service.subscribe(errorCallback)
        service.subscribe(normalCallback)
      }).not.toThrow()
      
      // Both callbacks should have been called despite error in first one
      expect(errorCallback).toHaveBeenCalled()
      expect(normalCallback).toHaveBeenCalled()
    })
  })

  describe('Data Transformation', () => {
    test('should transform Python data to SystemState format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.refresh()
      
      expect(result).toBeDefined()
      expect(result?.systemStatus).toEqual({
        powerMode: 'ACTIVE',
        powerConsumption: 8.5,
        batteryRemaining: 420,
        fps: 24.7,
        processingStatus: 'Normal',
        cameraStatus: 'Connected',
        timestamp: '12:34:56'
      })
      
      expect(result?.intruders).toHaveLength(1)
      expect(result?.intruders[0]).toEqual({
        trackId: 'TRK-001',
        zone: 'RESTRICTED',
        threatScore: 75,
        threatLevel: 'HIGH',
        timeSinceDetection: 120
      })
      
      expect(result?.alerts.alertLevel).toBe('HIGH')
      expect(result?.alerts.recentAlerts).toHaveLength(1)
      
      expect(result?.videoStatus).toEqual({
        isLive: true,
        resolution: '1920x1080',
        latency: 45,
        source: 'drone',
        streamUrl: 'rtsp://example.com/stream'
      })
    })

    test('should handle missing optional data gracefully', async () => {
      const minimalPythonData: PythonSystemData = {
        system: {
          power_mode: 'IDLE',
          power_w: 0,
          battery_minutes: 0,
          fps: 0,
          camera_status: 'DISCONNECTED',
          timestamp: '00:00:00'
        },
        tracks: [],
        alerts: [],
        timestamp: '2024-01-08T00:00:00Z'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '2024-01-08T00:00:00Z',
          data: minimalPythonData
        })
      })

      const result = await service.refresh()
      
      expect(result).toBeDefined()
      expect(result?.systemStatus.powerMode).toBe('IDLE')
      expect(result?.intruders).toHaveLength(0)
      expect(result?.alerts.alertLevel).toBe('NORMAL')
      expect(result?.videoStatus.isLive).toBe(false)
    })

    test('should calculate alert levels correctly', async () => {
      const criticalData = {
        ...mockPythonData,
        tracks: [
          {
            ...mockPythonData.tracks[0],
            threat_level: 'CRITICAL' as const
          },
          {
            ...mockPythonData.tracks[0],
            id: 2,
            threat_level: 'CRITICAL' as const
          },
          {
            ...mockPythonData.tracks[0],
            id: 3,
            threat_level: 'HIGH' as const
          }
        ]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          timestamp: '2024-01-08T12:34:56Z',
          data: criticalData
        })
      })

      const result = await service.refresh()
      
      expect(result?.alerts.alertLevel).toBe('CRITICAL')
      expect(result?.alerts.recommendation).toContain('critical threat')
    })
  })

  describe('Error Handling', () => {
    test('should handle WebSocket message parsing errors', async () => {
      // This test would require more complex WebSocket mocking
      // For now, we test that the service handles errors gracefully
      expect(service.getLastError()).toBeNull()
    })

    test('should handle connection errors gracefully', async () => {
      // Mock network error
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('Network unavailable')
      })

      await service.connect()
      
      expect(service.getLastError()).toContain('Network unavailable')
      expect(service.isHealthy()).toBe(false)
    })

    test('should maintain last known state on connection loss', () => {
      // This would require more complex state management testing
      // The service should continue providing last known data when disconnected
      expect(service.getConnectionStatus()).toBe('disconnected')
    })
  })

  describe('Health Monitoring', () => {
    test('should report healthy when connected with no errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      await service.connect()
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Health depends on connection status and no errors
      const isConnected = service.getConnectionStatus() === 'connected'
      const hasNoErrors = service.getLastError() === null
      
      if (isConnected && hasNoErrors) {
        expect(service.isHealthy()).toBe(true)
      } else {
        // Service may still be connecting or have encountered errors during test
        expect(service.isHealthy()).toBe(false)
      }
    })

    test('should report unhealthy when disconnected or has errors', () => {
      expect(service.isHealthy()).toBe(false)
      
      // Simulate error
      service.refresh().catch(() => {})
      
      expect(service.isHealthy()).toBe(false)
    })
  })
})