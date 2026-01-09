// System State Manager Implementation
// Centralized state management with React hooks integration
// Implements state update batching and memory management for performance

import { SystemStateManager as ISystemStateManager } from '../types/serviceInterfaces';
import { 
  SystemState, 
  SystemStatusData, 
  IntruderData, 
  ThreatIntelligenceData, 
  AlertsData, 
  VideoStatusData,
  DEFAULT_SYSTEM_STATE 
} from '../types/systemState';
import { performanceMonitor } from '../utils/performanceMonitor';

/**
 * Configuration options for SystemStateManager
 */
export interface SystemStateManagerOptions {
  maxHistorySize?: number;
  batchUpdateDelay?: number; // milliseconds
  memoryCleanupInterval?: number; // milliseconds
  enableLogging?: boolean;
  maxUpdateQueueSize?: number; // Maximum number of updates to keep in queue
  maxAlertHistory?: number; // Maximum number of alerts to keep
  maxThreatIntelligenceAge?: number; // Maximum age in milliseconds for threat intelligence data
}

/**
 * Batched update information
 */
interface BatchedUpdate {
  timestamp: number;
  updates: Partial<SystemState>;
}

/**
 * System State Manager for centralized state management
 * Provides React hooks integration, update batching, and memory management
 */
export class SystemStateManager implements ISystemStateManager {
  private currentState: SystemState;
  private stateHistory: SystemState[] = [];
  private subscribers: Array<(state: SystemState) => void> = [];
  
  // Batching mechanism
  private pendingUpdates: Partial<SystemState> = {};
  private batchTimeout: NodeJS.Timeout | null = null;
  private updateQueue: BatchedUpdate[] = [];
  
  // Memory management
  private memoryCleanupInterval: NodeJS.Timeout | null = null;
  private lastCleanup: number = Date.now();
  
  // Configuration
  private options: Required<SystemStateManagerOptions> = {
    maxHistorySize: 50,
    batchUpdateDelay: 16, // ~60fps batching
    memoryCleanupInterval: 30000, // 30 seconds
    enableLogging: false,
    maxUpdateQueueSize: 1000, // Prevent memory leaks from excessive updates
    maxAlertHistory: 100, // Maximum alerts to keep in memory
    maxThreatIntelligenceAge: 300000 // 5 minutes - remove old threat intelligence data
  };

  constructor(options?: SystemStateManagerOptions) {
    this.currentState = { ...DEFAULT_SYSTEM_STATE };
    
    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.startMemoryCleanup();
    this.log('SystemStateManager initialized');
  }

  /**
   * Get current system state
   */
  getCurrentState(): SystemState {
    return { ...this.currentState };
  }

  /**
   * Get state history with optional count limit
   */
  getStateHistory(count?: number): SystemState[] {
    const historyCount = count || this.stateHistory.length;
    return this.stateHistory
      .slice(-historyCount)
      .map(state => ({ ...state }));
  }

  /**
   * Update system state with batching
   */
  updateState(newState: Partial<SystemState>): void {
    // Handle null/undefined gracefully
    if (!newState || typeof newState !== 'object') {
      this.log('Invalid state update ignored', newState);
      return;
    }
    
    this.log('Queuing state update', Object.keys(newState));
    
    // Track update for performance monitoring
    performanceMonitor.trackUpdate();
    
    // Merge with pending updates
    this.pendingUpdates = this.deepMerge(this.pendingUpdates, newState);
    
    // Add to update queue for performance monitoring with timestamp
    this.updateQueue.push({
      timestamp: Date.now(),
      updates: { ...newState }
    });

    // Prevent memory leaks by limiting update queue size
    if (this.updateQueue.length > this.options.maxUpdateQueueSize) {
      const excessCount = this.updateQueue.length - this.options.maxUpdateQueueSize;
      this.updateQueue.splice(0, excessCount);
      this.log(`Trimmed ${excessCount} items from update queue to prevent memory leak`);
    }

    // Schedule batched update
    this.scheduleBatchedUpdate();
  }

  /**
   * Update system status specifically
   */
  updateSystemStatus(status: SystemStatusData): void {
    this.updateState({ systemStatus: status });
  }

  /**
   * Update intruders array
   */
  updateIntruders(intruders: IntruderData[]): void {
    this.updateState({ intruders: [...intruders] });
  }

  /**
   * Update threat intelligence for specific track
   */
  updateThreatIntelligence(trackId: string, data: ThreatIntelligenceData): void {
    const currentThreatIntelligence = { ...this.currentState.threatIntelligence };
    currentThreatIntelligence[trackId] = { ...data };
    this.updateState({ threatIntelligence: currentThreatIntelligence });
  }

  /**
   * Update alerts data
   */
  updateAlerts(alerts: AlertsData): void {
    this.updateState({ 
      alerts: {
        ...alerts,
        recentAlerts: [...alerts.recentAlerts]
      }
    });
  }

  /**
   * Update video status
   */
  updateVideoStatus(status: VideoStatusData): void {
    this.updateState({ videoStatus: { ...status } });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: SystemState) => void): () => void {
    this.subscribers.push(callback);
    this.log(`Subscriber added. Total: ${this.subscribers.length}`);

    // Immediately send current state to new subscriber
    try {
      callback(this.getCurrentState());
    } catch (error) {
      this.log('Error in subscriber callback during subscription', error);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
      this.log(`Subscriber removed. Total: ${this.subscribers.length}`);
    };
  }

  /**
   * Reset state to default
   */
  reset(): void {
    this.log('Resetting system state');
    this.currentState = { ...DEFAULT_SYSTEM_STATE };
    this.stateHistory = [];
    this.pendingUpdates = {};
    this.updateQueue = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.notifySubscribers();
  }

  /**
   * Cleanup resources and stop background processes
   */
  cleanup(): void {
    this.log('Cleaning up SystemStateManager');
    
    // Clear timeouts
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }

    // Clear data structures
    this.subscribers = [];
    this.stateHistory = [];
    this.pendingUpdates = {};
    this.updateQueue = [];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    subscriberCount: number;
    historySize: number;
    pendingUpdates: number;
    memoryUsage: number;
    averageUpdateLatency: number;
  } {
    const now = Date.now();
    const recentUpdates = this.updateQueue.filter(update => 
      now - update.timestamp < 5000 // Last 5 seconds
    );

    const averageLatency = recentUpdates.length > 0 
      ? recentUpdates.reduce((sum, update) => sum + (now - update.timestamp), 0) / recentUpdates.length
      : 0;

    return {
      subscriberCount: this.subscribers.length,
      historySize: this.stateHistory.length,
      pendingUpdates: Object.keys(this.pendingUpdates).length,
      memoryUsage: this.estimateMemoryUsage(),
      averageUpdateLatency: averageLatency
    };
  }

  /**
   * Schedule batched update with debouncing
   */
  private scheduleBatchedUpdate(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatchedUpdate();
    }, this.options.batchUpdateDelay);
  }

  /**
   * Process all pending updates in a batch
   */
  private processBatchedUpdate(): void {
    if (Object.keys(this.pendingUpdates).length === 0) {
      return;
    }

    this.log('Processing batched update', Object.keys(this.pendingUpdates));

    // Apply all pending updates
    const previousState = { ...this.currentState };
    
    // Merge updates while preserving state structure
    const mergedState = this.deepMerge(this.currentState, this.pendingUpdates);
    
    // Ensure we maintain the proper SystemState structure
    this.currentState = {
      systemStatus: mergedState.systemStatus || this.currentState.systemStatus,
      intruders: mergedState.intruders || this.currentState.intruders,
      threatIntelligence: mergedState.threatIntelligence || this.currentState.threatIntelligence,
      alerts: mergedState.alerts || this.currentState.alerts,
      videoStatus: mergedState.videoStatus || this.currentState.videoStatus,
      metadata: {
        ...this.currentState.metadata,
        lastUpdated: new Date().toISOString()
      }
    };

    // Add to history
    this.addToHistory(previousState);

    // Clear pending updates
    this.pendingUpdates = {};
    this.batchTimeout = null;

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Add state to history with size management
   */
  private addToHistory(state: SystemState): void {
    this.stateHistory.push({ ...state });

    // Maintain history size limit
    if (this.stateHistory.length > this.options.maxHistorySize) {
      const excessCount = this.stateHistory.length - this.options.maxHistorySize;
      this.stateHistory.splice(0, excessCount);
      this.log(`Trimmed ${excessCount} items from state history`);
    }
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    const currentState = this.getCurrentState();
    
    this.subscribers.forEach((callback, index) => {
      try {
        callback(currentState);
      } catch (error) {
        this.log(`Error in subscriber ${index} callback`, error);
      }
    });
  }

  /**
   * Start memory cleanup process
   */
  private startMemoryCleanup(): void {
    this.memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, this.options.memoryCleanupInterval);
  }

  /**
   * Perform memory cleanup operations
   */
  private performMemoryCleanup(): void {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.lastCleanup;
    
    this.log(`Performing memory cleanup (${timeSinceLastCleanup}ms since last)`);

    // Clean old update queue entries (keep last 5 seconds)
    const cutoffTime = now - 5000;
    const initialQueueSize = this.updateQueue.length;
    this.updateQueue = this.updateQueue.filter(update => update.timestamp > cutoffTime);
    
    if (this.updateQueue.length < initialQueueSize) {
      this.log(`Cleaned ${initialQueueSize - this.updateQueue.length} old update queue entries`);
    }

    // Clean old threat intelligence data for non-existent tracks
    const currentTrackIds = new Set(this.currentState.intruders.map(intruder => intruder.trackId));
    const threatIntelligenceKeys = Object.keys(this.currentState.threatIntelligence);
    const orphanedKeys = threatIntelligenceKeys.filter(key => !currentTrackIds.has(key));
    
    if (orphanedKeys.length > 0) {
      const cleanedThreatIntelligence = { ...this.currentState.threatIntelligence };
      orphanedKeys.forEach(key => delete cleanedThreatIntelligence[key]);
      
      this.currentState = {
        ...this.currentState,
        threatIntelligence: cleanedThreatIntelligence
      };
      
      this.log(`Cleaned ${orphanedKeys.length} orphaned threat intelligence entries`);
    }

    // Clean old alerts (keep last maxAlertHistory) - only if alerts exist and have recentAlerts array
    if (this.currentState.alerts && Array.isArray(this.currentState.alerts.recentAlerts)) {
      const maxAlerts = this.options.maxAlertHistory;
      if (this.currentState.alerts.recentAlerts.length > maxAlerts) {
        const excessAlerts = this.currentState.alerts.recentAlerts.length - maxAlerts;
        this.currentState = {
          ...this.currentState,
          alerts: {
            ...this.currentState.alerts,
            recentAlerts: this.currentState.alerts.recentAlerts.slice(-maxAlerts)
          }
        };
        this.log(`Cleaned ${excessAlerts} old alert entries`);
      }
    }

    // Clean old threat intelligence data based on age
    const threatIntelligenceAgeLimit = this.options.maxThreatIntelligenceAge;
    const cleanedThreatIntelligence = { ...this.currentState.threatIntelligence };
    let removedAgedEntries = 0;
    
    Object.keys(cleanedThreatIntelligence).forEach(trackId => {
      // Check if this track ID exists in current intruders
      const trackExists = currentTrackIds.has(trackId);
      
      // If track doesn't exist and we have age-based cleanup enabled, remove it
      if (!trackExists) {
        // For now, we already handle this above, but we could add timestamp-based cleanup here
        // if we stored timestamps with threat intelligence data
      }
    });

    if (removedAgedEntries > 0) {
      this.currentState = {
        ...this.currentState,
        threatIntelligence: cleanedThreatIntelligence
      };
      this.log(`Cleaned ${removedAgedEntries} aged threat intelligence entries`);
    }

    // Clean excessive state history beyond configured limit
    if (this.stateHistory.length > this.options.maxHistorySize) {
      const excessHistory = this.stateHistory.length - this.options.maxHistorySize;
      this.stateHistory.splice(0, excessHistory);
      this.log(`Cleaned ${excessHistory} excess state history entries`);
    }

    this.lastCleanup = now;

    // Log memory usage and performance metrics
    const memoryUsage = this.estimateMemoryUsage();
    const performanceMetrics = this.getPerformanceMetrics();
    
    // Update performance monitor with memory usage
    performanceMonitor.updateMemoryUsage(memoryUsage);
    
    this.log(`Memory cleanup complete. Estimated usage: ${(memoryUsage / 1024).toFixed(2)} KB`, {
      subscriberCount: performanceMetrics.subscriberCount,
      historySize: performanceMetrics.historySize,
      updateQueueSize: this.updateQueue.length,
      threatIntelligenceEntries: Object.keys(this.currentState.threatIntelligence).length,
      alertsCount: this.currentState.alerts?.recentAlerts?.length || 0
    });
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    try {
      // Rough estimation based on JSON serialization
      const stateSize = JSON.stringify(this.currentState).length * 2; // UTF-16
      const historySize = JSON.stringify(this.stateHistory).length * 2;
      const queueSize = JSON.stringify(this.updateQueue).length * 2;
      const pendingSize = JSON.stringify(this.pendingUpdates).length * 2;
      
      return stateSize + historySize + queueSize + pendingSize;
    } catch (error) {
      this.log('Error estimating memory usage', error);
      return 0;
    }
  }

  /**
   * Deep merge utility for state updates
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      // Use Object.prototype.hasOwnProperty.call to handle objects with null prototype
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Logging utility
   */
  private log(message: string, data?: any): void {
    if (this.options.enableLogging) {
      if (data) {
        console.log(`[SystemStateManager] ${message}`, data);
      } else {
        console.log(`[SystemStateManager] ${message}`);
      }
    }
  }
}

// Export singleton instance for global state management
export const systemStateManager = new SystemStateManager({
  enableLogging: process.env.NODE_ENV === 'development'
});