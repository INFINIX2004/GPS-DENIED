// Service Layer Interface Types
// Interfaces for backend communication and data transformation

import { SystemState, ConnectionStatus, DataSource } from './systemState';
import { PythonSystemData } from './pythonInterfaces';

/**
 * Backend Service interface for communicating with AeroVision Python system
 */
export interface BackendService {
  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  getConnectionStatus(): ConnectionStatus;
  
  // Data subscription
  subscribe(callback: (state: SystemState) => void): () => void;
  
  // Manual operations
  refresh(): Promise<SystemState | null>;
  
  // Configuration
  configure(options: BackendServiceOptions): void;
  
  // Health check
  isHealthy(): boolean;
  getLastError(): string | null;
}

/**
 * Backend Service configuration options
 */
export interface BackendServiceOptions {
  websocketUrl?: string;
  apiUrl?: string;
  preferWebSocket?: boolean;
  updateFrequency?: number; // Hz for REST polling
  maxReconnectAttempts?: number;
  reconnectDelay?: number; // milliseconds
  timeout?: number; // milliseconds
  enableLogging?: boolean;
}

/**
 * Data Transformer interface for converting Python data to TypeScript
 */
export interface DataTransformer {
  // Main transformation methods
  transformSystemData(pythonData: PythonSystemData): SystemState;
  
  // Individual component transformations
  transformSystemStatus(pythonSystem: any): import('./systemState').SystemStatusData;
  transformTracks(pythonTracks: any[]): import('./systemState').IntruderData[];
  transformThreatData(pythonTracks: any[]): Record<string, import('./systemState').ThreatIntelligenceData>;
  transformAlerts(pythonAlerts: any[], tracks?: any[]): import('./systemState').AlertsData;
  transformVideoStatus(pythonVideo?: any): import('./systemState').VideoStatusData;
  
  // Validation methods
  validatePythonData(data: any): boolean;
  sanitizeData(data: any): any;
}

/**
 * System State Manager interface for centralized state management
 */
export interface SystemStateManager {
  // State access
  getCurrentState(): SystemState;
  getStateHistory(count?: number): SystemState[];
  
  // State updates
  updateState(newState: Partial<SystemState>): void;
  updateSystemStatus(status: import('./systemState').SystemStatusData): void;
  updateIntruders(intruders: import('./systemState').IntruderData[]): void;
  updateThreatIntelligence(trackId: string, data: import('./systemState').ThreatIntelligenceData): void;
  updateAlerts(alerts: import('./systemState').AlertsData): void;
  updateVideoStatus(status: import('./systemState').VideoStatusData): void;
  
  // Subscriptions
  subscribe(callback: (state: SystemState) => void): () => void;
  
  // Utilities
  reset(): void;
  cleanup(): void;
}

/**
 * WebSocket Handler interface for real-time communication
 */
export interface WebSocketHandler {
  connect(url: string): Promise<void>;
  disconnect(): void;
  send(message: any): void;
  isConnected(): boolean;
  onMessage(callback: (data: any) => void): () => void;
  onError(callback: (error: Error) => void): () => void;
  onClose(callback: () => void): () => void;
}

/**
 * REST API Handler interface for HTTP communication
 */
export interface RestApiHandler {
  get(endpoint: string): Promise<any>;
  post(endpoint: string, data: any): Promise<any>;
  setBaseUrl(url: string): void;
  setTimeout(timeout: number): void;
  setHeaders(headers: Record<string, string>): void;
}

/**
 * Connection Manager interface for handling fallbacks and retries
 */
export interface ConnectionManager {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  
  // Status monitoring
  getStatus(): ConnectionStatus;
  getDataSource(): DataSource;
  getLastConnected(): Date | null;
  getErrorCount(): number;
  
  // Configuration
  setPreferredProtocol(protocol: 'websocket' | 'rest'): void;
  setRetryPolicy(maxAttempts: number, delay: number): void;
  
  // Event handlers
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void;
  onDataSourceChange(callback: (source: DataSource) => void): () => void;
}

/**
 * Performance Monitor interface for tracking system performance
 */
export interface PerformanceMonitor {
  // Metrics tracking
  recordUpdateLatency(latency: number): void;
  recordDataSize(bytes: number): void;
  recordRenderTime(component: string, time: number): void;
  
  // Memory monitoring
  getMemoryUsage(): MemoryUsage;
  triggerGarbageCollection(): void;
  
  // Performance reports
  getPerformanceReport(): PerformanceReport;
  resetMetrics(): void;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  used: number; // bytes
  total: number; // bytes
  percentage: number; // 0-100
  stateSize: number; // bytes
  historySize: number; // bytes
}

/**
 * Performance report data
 */
export interface PerformanceReport {
  averageUpdateLatency: number; // milliseconds
  maxUpdateLatency: number; // milliseconds
  averageDataSize: number; // bytes
  updateFrequency: number; // Hz
  memoryUsage: MemoryUsage;
  componentRenderTimes: Record<string, number>; // milliseconds
  errorRate: number; // percentage
  uptime: number; // milliseconds
}

/**
 * Error Handler interface for centralized error management
 */
export interface ErrorHandler {
  // Error reporting
  reportError(error: Error, context?: string): void;
  reportWarning(message: string, context?: string): void;
  
  // Error recovery
  attemptRecovery(error: Error): Promise<boolean>;
  
  // Error tracking
  getErrorHistory(): ErrorRecord[];
  getErrorCount(timeWindow?: number): number; // timeWindow in milliseconds
  
  // Configuration
  setErrorThreshold(count: number, timeWindow: number): void;
  onErrorThresholdExceeded(callback: () => void): () => void;
}

/**
 * Error record for tracking
 */
export interface ErrorRecord {
  timestamp: Date;
  error: Error;
  context?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recovered: boolean;
}

/**
 * Service factory interface for dependency injection
 */
export interface ServiceFactory {
  createBackendService(options?: BackendServiceOptions): BackendService;
  createDataTransformer(): DataTransformer;
  createSystemStateManager(): SystemStateManager;
  createWebSocketHandler(): WebSocketHandler;
  createRestApiHandler(): RestApiHandler;
  createConnectionManager(): ConnectionManager;
  createPerformanceMonitor(): PerformanceMonitor;
  createErrorHandler(): ErrorHandler;
}

/**
 * Service configuration for the entire system
 */
export interface ServiceConfiguration {
  backend: BackendServiceOptions;
  performance: {
    enableMonitoring: boolean;
    maxHistorySize: number;
    memoryThreshold: number; // percentage
    updateBatchSize: number;
  };
  error: {
    maxRetries: number;
    retryDelay: number;
    errorThreshold: number;
    enableRecovery: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
  };
}