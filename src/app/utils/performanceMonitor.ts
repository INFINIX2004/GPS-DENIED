// Performance Monitoring Utility
// Tracks component re-renders, memory usage, and update frequencies
// Provides insights for performance optimization

interface PerformanceMetrics {
  componentRenders: Record<string, number>;
  memoryUsage: number;
  updateFrequency: number;
  lastUpdateTime: number;
  averageRenderTime: Record<string, number>;
}

interface RenderTiming {
  componentName: string;
  startTime: number;
  endTime?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    componentRenders: {},
    memoryUsage: 0,
    updateFrequency: 0,
    lastUpdateTime: 0,
    averageRenderTime: {}
  };

  private renderTimings: Map<string, RenderTiming> = new Map();
  private updateTimes: number[] = [];
  private isEnabled: boolean = process.env.NODE_ENV === 'development';

  /**
   * Track component render start
   */
  startRender(componentName: string): void {
    if (!this.isEnabled) return;

    const startTime = performance.now();
    this.renderTimings.set(componentName, {
      componentName,
      startTime
    });

    // Increment render count
    this.metrics.componentRenders[componentName] = 
      (this.metrics.componentRenders[componentName] || 0) + 1;
  }

  /**
   * Track component render end
   */
  endRender(componentName: string): void {
    if (!this.isEnabled) return;

    const endTime = performance.now();
    const timing = this.renderTimings.get(componentName);
    
    if (timing) {
      timing.endTime = endTime;
      const renderTime = endTime - timing.startTime;
      
      // Update average render time
      const currentAverage = this.metrics.averageRenderTime[componentName] || 0;
      const renderCount = this.metrics.componentRenders[componentName] || 1;
      
      this.metrics.averageRenderTime[componentName] = 
        (currentAverage * (renderCount - 1) + renderTime) / renderCount;
      
      this.renderTimings.delete(componentName);
    }
  }

  /**
   * Track state update
   */
  trackUpdate(): void {
    if (!this.isEnabled) return;

    const now = Date.now();
    this.updateTimes.push(now);
    
    // Keep only last 100 updates for frequency calculation
    if (this.updateTimes.length > 100) {
      this.updateTimes.shift();
    }
    
    // Calculate update frequency (updates per second)
    if (this.updateTimes.length > 1) {
      const timeSpan = now - this.updateTimes[0];
      this.metrics.updateFrequency = (this.updateTimes.length - 1) / (timeSpan / 1000);
    }
    
    this.metrics.lastUpdateTime = now;
  }

  /**
   * Estimate memory usage
   */
  updateMemoryUsage(estimatedBytes: number): void {
    if (!this.isEnabled) return;
    this.metrics.memoryUsage = estimatedBytes;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalRenders: number;
    mostRenderedComponent: string;
    averageUpdateFrequency: number;
    memoryUsageKB: number;
    slowestComponent: string;
  } {
    const totalRenders = Object.values(this.metrics.componentRenders)
      .reduce((sum, count) => sum + count, 0);
    
    const mostRenderedComponent = Object.entries(this.metrics.componentRenders)
      .reduce((max, [name, count]) => count > max.count ? { name, count } : max, 
              { name: 'none', count: 0 }).name;
    
    const slowestComponent = Object.entries(this.metrics.averageRenderTime)
      .reduce((max, [name, time]) => time > max.time ? { name, time } : max,
              { name: 'none', time: 0 }).name;

    return {
      totalRenders,
      mostRenderedComponent,
      averageUpdateFrequency: this.metrics.updateFrequency,
      memoryUsageKB: this.metrics.memoryUsage / 1024,
      slowestComponent
    };
  }

  /**
   * Log performance summary to console
   */
  logSummary(): void {
    if (!this.isEnabled) return;

    const summary = this.getSummary();
    console.group('🚀 Performance Monitor Summary');
    console.log(`Total Renders: ${summary.totalRenders}`);
    console.log(`Most Rendered Component: ${summary.mostRenderedComponent}`);
    console.log(`Update Frequency: ${summary.averageUpdateFrequency.toFixed(2)} Hz`);
    console.log(`Memory Usage: ${summary.memoryUsageKB.toFixed(2)} KB`);
    console.log(`Slowest Component: ${summary.slowestComponent}`);
    console.log('Component Render Counts:', this.metrics.componentRenders);
    console.log('Average Render Times (ms):', 
      Object.fromEntries(
        Object.entries(this.metrics.averageRenderTime)
          .map(([name, time]) => [name, time.toFixed(2)])
      )
    );
    console.groupEnd();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      componentRenders: {},
      memoryUsage: 0,
      updateFrequency: 0,
      lastUpdateTime: 0,
      averageRenderTime: {}
    };
    this.renderTimings.clear();
    this.updateTimes = [];
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for tracking component renders
 */
export function useRenderTracking(componentName: string): void {
  React.useEffect(() => {
    performanceMonitor.startRender(componentName);
    return () => {
      performanceMonitor.endRender(componentName);
    };
  });
}

/**
 * Higher-order component for automatic render tracking
 */
export function withRenderTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const displayName = componentName || Component.displayName || Component.name || 'Component';
  
  const TrackedComponent = React.memo((props: P) => {
    useRenderTracking(displayName);
    return React.createElement(Component, props);
  });
  
  TrackedComponent.displayName = `withRenderTracking(${displayName})`;
  return TrackedComponent;
}

// Add React import for the hook
import React from 'react';