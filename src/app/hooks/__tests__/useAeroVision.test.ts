// useAeroVision Hook Tests
// Tests for the enhanced useAeroVision hook with SystemStateManager integration

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAeroVision } from '../useAeroVision';

// Mock the systemStateManager
vi.mock('../../services/systemStateManager', () => ({
  systemStateManager: {
    subscribe: vi.fn(),
    updateState: vi.fn(),
    updateSystemStatus: vi.fn(),
    getCurrentState: vi.fn()
  }
}));

// Mock the aeroVisionService
vi.mock('../../services/aeroVisionService', () => ({
  aeroVisionService: {
    subscribe: vi.fn(),
    getConnectionStatus: vi.fn(() => 'connected'),
    refresh: vi.fn()
  }
}));

describe('useAeroVision Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SystemStateManager Integration', () => {
    it('should use SystemStateManager by default', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      const mockUnsubscribe = vi.fn();
      vi.mocked(systemStateManager.subscribe).mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useAeroVision({ useMockData: true }));

      expect(systemStateManager.subscribe).toHaveBeenCalled();

      unmount();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should provide SystemStateManager integration flag', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      const mockUnsubscribe = vi.fn();
      vi.mocked(systemStateManager.subscribe).mockReturnValue(mockUnsubscribe);

      const { result } = renderHook(() => useAeroVision({ useSystemStateManager: true }));

      expect(result.current.usingSystemStateManager).toBe(true);
      expect(result.current.systemState).toBeDefined();
    });

    it('should fall back to legacy behavior when SystemStateManager is disabled', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      
      const { result } = renderHook(() => useAeroVision({ 
        useSystemStateManager: false,
        useMockData: true 
      }));

      expect(result.current.usingSystemStateManager).toBe(false);
      expect(result.current.systemState).toBeNull();
      expect(systemStateManager.subscribe).not.toHaveBeenCalled();
    });

    it('should handle connection status from SystemState metadata', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      
      const mockSystemState = {
        systemStatus: {
          powerMode: 'ACTIVE' as const,
          powerConsumption: 8.5,
          batteryRemaining: 420,
          fps: 24.7,
          processingStatus: 'Active',
          cameraStatus: 'Connected' as const,
          timestamp: '12:00:00'
        },
        intruders: [],
        threatIntelligence: {},
        alerts: {
          alertLevel: 'NORMAL' as const,
          recommendation: 'All clear',
          recentAlerts: []
        },
        videoStatus: {
          isLive: false,
          resolution: '1920x1080',
          latency: 50,
          source: 'webcam' as const
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          connectionStatus: 'connected' as const,
          dataSource: 'mock' as const,
          errorCount: 0
        }
      };

      let subscribeCallback: (state: any) => void;
      vi.mocked(systemStateManager.subscribe).mockImplementation((callback) => {
        subscribeCallback = callback;
        return vi.fn();
      });

      const { result } = renderHook(() => useAeroVision({ useMockData: true }));

      act(() => {
        subscribeCallback(mockSystemState);
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing hook interface', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      const mockUnsubscribe = vi.fn();
      vi.mocked(systemStateManager.subscribe).mockReturnValue(mockUnsubscribe);

      const { result } = renderHook(() => useAeroVision());

      // Check that all expected properties exist
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('connectionStatus');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refresh');
      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('isLoading');

      // Check types
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.isConnected).toBe('boolean');
      expect(typeof result.current.isLoading).toBe('boolean');
    });

    it('should handle refresh function with SystemStateManager', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      const mockUnsubscribe = vi.fn();
      vi.mocked(systemStateManager.subscribe).mockReturnValue(mockUnsubscribe);
      vi.mocked(systemStateManager.getCurrentState).mockReturnValue({
        metadata: { connectionStatus: 'connected' }
      } as any);

      const { result } = renderHook(() => useAeroVision({ 
        useMockData: false,
        useSystemStateManager: true 
      }));

      await act(async () => {
        await result.current.refresh();
      });

      // Should not throw error
      expect(result.current.error).toBeNull();
    });
  });

  describe('Mock Data Generation', () => {
    it('should generate mock data when useMockData is true', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      const mockUnsubscribe = vi.fn();
      vi.mocked(systemStateManager.subscribe).mockReturnValue(mockUnsubscribe);

      const { result } = renderHook(() => useAeroVision({ 
        useMockData: true,
        useSystemStateManager: true 
      }));

      expect(result.current.data).toBeDefined();
      expect(result.current.data.system).toBeDefined();
      expect(result.current.data.tracks).toBeDefined();
      expect(result.current.data.alerts).toBeDefined();
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should update SystemStateManager with mock data', async () => {
      const { systemStateManager } = await import('../../services/systemStateManager');
      const mockUnsubscribe = vi.fn();
      vi.mocked(systemStateManager.subscribe).mockReturnValue(mockUnsubscribe);

      renderHook(() => useAeroVision({ 
        useMockData: true,
        useSystemStateManager: true 
      }));

      expect(systemStateManager.updateState).toHaveBeenCalled();
    });
  });
});