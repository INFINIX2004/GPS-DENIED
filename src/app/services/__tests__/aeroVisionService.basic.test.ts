// Basic test for AeroVisionService integration
// Tests that the service can be instantiated and basic methods work

import { describe, it, expect } from 'vitest';
import { AeroVisionService } from '../aeroVisionService';

describe('AeroVisionService Basic Integration', () => {
  it('should instantiate without errors', () => {
    expect(() => {
      const service = new AeroVisionService();
      service.cleanup();
    }).not.toThrow();
  });

  it('should have all required methods', () => {
    const service = new AeroVisionService();
    
    expect(typeof service.subscribe).toBe('function');
    expect(typeof service.getConnectionStatus).toBe('function');
    expect(typeof service.refresh).toBe('function');
    expect(typeof service.cleanup).toBe('function');
    
    service.cleanup();
  });

  it('should return valid connection status', () => {
    const service = new AeroVisionService();
    
    const status = service.getConnectionStatus();
    expect(['connected', 'connecting', 'disconnected']).toContain(status);
    
    service.cleanup();
  });

  it('should handle subscription without errors', () => {
    const service = new AeroVisionService();
    
    expect(() => {
      const callback = () => {};
      const unsubscribe = service.subscribe(callback);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    }).not.toThrow();
    
    service.cleanup();
  });

  it('should handle refresh method', async () => {
    const service = new AeroVisionService();
    
    // Should not throw, may return null if no backend is available
    const result = await service.refresh();
    expect(result === null || typeof result === 'object').toBe(true);
    
    service.cleanup();
  });
});