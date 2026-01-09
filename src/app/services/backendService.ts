// Backend Service Implementation
// Handles communication with AeroVision Python backend via WebSocket and REST API
// Implements automatic fallback, exponential backoff retry, and subscription mechanism

import { 
  BackendService, 
  BackendServiceOptions,
  ConnectionStatus,
  DataSource 
} from '../types/serviceInterfaces';
import { 
  SystemState, 
  DEFAULT_SYSTEM_STATE 
} from '../types/systemState';
import { 
  PythonSystemData, 
  PythonWebSocketMessage, 
  PythonApiResponse,
  isPythonSystemData,
  isPythonWebSocketMessage 
} from '../types/pythonInterfaces';

/**
 * Backend Service for AeroVision Python system integration
 * Provides WebSocket and REST API communication with automatic fallback
 */
export class AeroVisionBackendService implements BackendService {
  private ws: WebSocket | null = null;
  private subscribers: Array<(state: SystemState) => void> = [];
  private connectionStatus: ConnectionStatus = 'disconnected';
  private dataSource: DataSource = 'rest';
  private lastError: string | null = null;
  private currentState: SystemState = { ...DEFAULT_SYSTEM_STATE };
  
  // Connection management
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // milliseconds
  private isConnecting = false;
  private restPollingInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private options: Required<BackendServiceOptions> = {
    websocketUrl: 'ws://localhost:8080/aerovision/stream',
    apiUrl: 'http://localhost:8080/aerovision/data',
    preferWebSocket: true,
    updateFrequency: 5, // Hz
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    timeout: 5000,
    enableLogging: true
  };

  constructor(options?: BackendServiceOptions) {
    if (options) {
      this.configure(options);
    }
    this.log('BackendService initialized');
  }

  /**
   * Configure the backend service with new options
   */
  configure(options: BackendServiceOptions): void {
    this.options = { ...this.options, ...options };
    this.log('BackendService configured', options);
  }

  /**
   * Connect to the AeroVision backend
   * Attempts WebSocket first, falls back to REST API polling
   */
  async connect(): Promise<void> {
    if (this.isConnecting) {
      this.log('Connection already in progress');
      return;
    }

    this.isConnecting = true;
    this.setConnectionStatus('connecting');
    this.lastError = null;

    try {
      if (this.options.preferWebSocket) {
        await this.connectWebSocket();
      } else {
        await this.startRestPolling();
      }
    } catch (error) {
      this.handleConnectionError(error as Error);
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from the backend
   */
  disconnect(): void {
    this.log('Disconnecting from backend');
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Stop REST polling
    if (this.restPollingInterval) {
      clearInterval(this.restPollingInterval);
      this.restPollingInterval = null;
    }

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.setConnectionStatus('disconnected');
    this.dataSource = 'rest';
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Subscribe to real-time data updates
   */
  subscribe(callback: (state: SystemState) => void): () => void {
    this.subscribers.push(callback);
    this.log(`Subscriber added. Total: ${this.subscribers.length}`);

    // Start connection if not already connected and we have subscribers
    if (this.connectionStatus === 'disconnected' && this.subscribers.length === 1) {
      this.connect().catch(error => {
        this.log('Failed to auto-connect on first subscription', error);
      });
    }

    // Immediately send current state to new subscriber
    try {
      callback(this.currentState);
    } catch (error) {
      this.log('Error in subscriber callback during subscription', error);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
      this.log(`Subscriber removed. Total: ${this.subscribers.length}`);
      
      // Disconnect if no more subscribers
      if (this.subscribers.length === 0) {
        this.disconnect();
      }
    };
  }

  /**
   * Manual data refresh
   */
  async refresh(): Promise<SystemState | null> {
    try {
      const data = await this.fetchRestData();
      if (data) {
        // Transform Python data to SystemState format without notifying subscribers
        const newState = this.transformPythonData(data);
        
        // Update current state without triggering notifications
        this.currentState = {
          ...newState,
          metadata: {
            ...newState.metadata,
            lastUpdated: new Date().toISOString(),
            connectionStatus: this.connectionStatus,
            dataSource: this.dataSource,
            updateFrequency: this.options.updateFrequency
          }
        };
        
        return this.currentState;
      }
    } catch (error) {
      this.handleError(error as Error, 'Manual refresh failed');
    }
    return null;
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    return this.connectionStatus === 'connected' && this.lastError === null;
  }

  /**
   * Get last error message
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Connect via WebSocket with retry logic
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.log(`Attempting WebSocket connection to ${this.options.websocketUrl}`);
        this.ws = new WebSocket(this.options.websocketUrl);

        const connectionTimeout = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.options.timeout);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.log('WebSocket connected successfully');
          this.setConnectionStatus('connected');
          this.dataSource = 'websocket';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.log(`WebSocket closed: ${event.code} - ${event.reason}`);
          this.handleWebSocketClose();
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          this.log('WebSocket error', error);
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      if (isPythonWebSocketMessage(message)) {
        this.log(`Received WebSocket message: ${message.type}`);
        
        switch (message.type) {
          case 'system_update':
            if (message.data && isPythonSystemData(message.data)) {
              this.updateSystemState(message.data);
            }
            break;
          case 'heartbeat':
            // Heartbeat received, connection is alive
            break;
          default:
            this.log(`Unknown WebSocket message type: ${message.type}`);
        }
      } else if (isPythonSystemData(message)) {
        // Direct system data without wrapper
        this.updateSystemState(message);
      } else {
        this.log('Invalid WebSocket message format', message);
      }
    } catch (error) {
      this.log('Failed to parse WebSocket message', error);
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleWebSocketClose(): void {
    this.ws = null;
    this.setConnectionStatus('disconnected');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Attempt reconnection if we have subscribers
    if (this.subscribers.length > 0) {
      this.attemptReconnect();
    }
  }

  /**
   * Start REST API polling as fallback
   */
  private async startRestPolling(): Promise<void> {
    this.log(`Starting REST API polling at ${this.options.updateFrequency} Hz`);
    this.dataSource = 'rest';
    this.setConnectionStatus('connected');

    const pollInterval = 1000 / this.options.updateFrequency; // Convert Hz to milliseconds

    this.restPollingInterval = setInterval(async () => {
      if (this.subscribers.length === 0) {
        this.disconnect();
        return;
      }

      try {
        const data = await this.fetchRestData();
        if (data) {
          this.updateSystemState(data);
        }
      } catch (error) {
        this.handleError(error as Error, 'REST polling failed');
      }
    }, pollInterval);

    // Initial fetch
    try {
      const data = await this.fetchRestData();
      if (data) {
        this.updateSystemState(data);
      }
    } catch (error) {
      this.handleError(error as Error, 'Initial REST fetch failed');
    }
  }

  /**
   * Fetch data via REST API
   */
  private async fetchRestData(): Promise<PythonSystemData | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(this.options.apiUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: PythonApiResponse = await response.json();
      
      if (result.success && result.data && isPythonSystemData(result.data)) {
        return result.data;
      } else {
        console.error('[BackendService] Invalid API response:', result);
        throw new Error(result.error || 'Invalid API response format');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached, falling back to REST API');
      this.startRestPolling().catch(error => {
        this.handleError(error as Error, 'REST fallback failed');
      });
      return;
    }

    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.subscribers.length > 0) {
        this.connect().catch(error => {
          this.log('Reconnection attempt failed', error);
        });
      }
    }, delay);
  }

  /**
   * Start heartbeat mechanism for WebSocket
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      }
    }, 30000); // 30 second heartbeat
  }

  /**
   * Update system state and notify subscribers
   */
  private updateSystemState(pythonData: PythonSystemData): void {
    try {
      // Transform Python data to SystemState format
      const newState = this.transformPythonData(pythonData);
      
      // Update current state
      this.currentState = {
        ...newState,
        metadata: {
          ...newState.metadata,
          lastUpdated: new Date().toISOString(),
          connectionStatus: this.connectionStatus,
          dataSource: this.dataSource,
          updateFrequency: this.options.updateFrequency
        }
      };

      // Notify all subscribers
      this.notifySubscribers();
      
    } catch (error) {
      this.handleError(error as Error, 'Failed to update system state');
    }
  }

  /**
   * Transform Python data to SystemState format
   * This is a basic transformation - will be enhanced by DataTransformer in task 3
   */
  private transformPythonData(pythonData: PythonSystemData): SystemState {
    return {
      systemStatus: {
        powerMode: pythonData.system.power_mode,
        powerConsumption: pythonData.system.power_w,
        batteryRemaining: pythonData.system.battery_minutes,
        fps: pythonData.system.fps,
        processingStatus: pythonData.system.processing_status || 'Active',
        cameraStatus: pythonData.system.camera_status === 'CONNECTED' ? 'Connected' : 'Lost',
        timestamp: pythonData.system.timestamp
      },
      intruders: pythonData.tracks.map(track => ({
        trackId: `TRK-${track.id.toString().padStart(3, '0')}`,
        zone: track.zone,
        threatScore: Math.round(track.threat_score),
        threatLevel: track.threat_level,
        timeSinceDetection: track.detection_time
      })),
      threatIntelligence: this.transformThreatIntelligence(pythonData.tracks),
      alerts: {
        alertLevel: this.calculateAlertLevel(pythonData.tracks, pythonData.alerts),
        recommendation: this.generateRecommendation(pythonData.tracks, pythonData.alerts),
        recentAlerts: pythonData.alerts.map((alert, index) => ({
          id: alert.id || `alert-${index}`,
          timestamp: alert.time,
          message: alert.message,
          type: alert.level.toLowerCase() as 'info' | 'warning' | 'critical'
        }))
      },
      videoStatus: {
        isLive: pythonData.video?.is_live || false,
        resolution: pythonData.video ? 
          `${pythonData.video.resolution.width}x${pythonData.video.resolution.height}` : 
          '0x0',
        latency: pythonData.video?.latency_ms || 0,
        source: pythonData.video?.source || 'placeholder',
        streamUrl: pythonData.video?.stream_url
      },
      metadata: {
        lastUpdated: pythonData.timestamp,
        connectionStatus: this.connectionStatus,
        dataSource: this.dataSource
      }
    };
  }

  /**
   * Transform threat intelligence data
   */
  private transformThreatIntelligence(tracks: any[]): Record<string, any> {
    const intelligence: Record<string, any> = {};
    
    tracks.forEach(track => {
      const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
      intelligence[trackId] = {
        threatBreakdown: track.explanation.map((item: any) => ({
          factor: item.factor,
          score: item.points
        })),
        behavioral: {
          loitering: track.behavior.loitering.active,
          loiteringDuration: track.behavior.loitering.duration,
          speedAnomaly: track.behavior.speed_anomaly,
          trajectoryStability: this.capitalizeFirst(track.behavior.trajectory_stability || 'stable'),
          trajectoryConfidence: Math.round((track.behavior.trajectory_confidence || 0) * 100)
        },
        prediction: {
          nearTerm: track.prediction.near.description || `Moving toward ${track.prediction.near.zone}`,
          mediumTerm: track.prediction.medium.description || `Expected in ${track.prediction.medium.zone}`,
          farTerm: track.prediction.far.description || `Long-term: ${track.prediction.far.zone}`,
          confidence: this.mapConfidenceLevel(track.prediction.overall_confidence || 0),
          willEnterRestricted: track.prediction.will_enter_restricted || false
        }
      };
    });

    return intelligence;
  }

  /**
   * Calculate overall alert level
   */
  private calculateAlertLevel(tracks: any[], alerts: any[]): 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' {
    const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL').length;
    const highThreatTracks = tracks.filter(t => t.threat_level === 'CRITICAL' || t.threat_level === 'HIGH').length;

    if (criticalAlerts > 0 || highThreatTracks > 2) return 'CRITICAL';
    if (highThreatTracks > 0) return 'HIGH';
    if (tracks.length > 0) return 'ELEVATED';
    return 'NORMAL';
  }

  /**
   * Generate recommendation based on current situation
   */
  private generateRecommendation(tracks: any[], alerts: any[]): string {
    const criticalTracks = tracks.filter(t => t.threat_level === 'CRITICAL').length;
    const highThreatTracks = tracks.filter(t => t.threat_level === 'HIGH').length;

    if (criticalTracks > 0) {
      return `${criticalTracks} critical threat${criticalTracks > 1 ? 's' : ''} detected - immediate response required`;
    }
    if (highThreatTracks > 0) {
      return `${highThreatTracks} high threat${highThreatTracks > 1 ? 's' : ''} detected - monitor closely`;
    }
    if (tracks.length > 0) {
      return `${tracks.length} track${tracks.length > 1 ? 's' : ''} under surveillance - normal monitoring`;
    }
    return 'All clear - no active threats detected';
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.currentState);
      } catch (error) {
        this.log('Error in subscriber callback', error);
      }
    });
  }

  /**
   * Set connection status and update metadata
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.currentState = {
      ...this.currentState,
      metadata: {
        ...this.currentState.metadata,
        connectionStatus: status
      }
    };
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    this.lastError = error.message;
    this.log('Connection error', error);
    
    if (this.options.preferWebSocket && this.dataSource !== 'rest') {
      this.log('WebSocket failed, falling back to REST API');
      this.startRestPolling().catch(restError => {
        this.handleError(restError as Error, 'REST fallback failed');
      });
    }
  }

  /**
   * Handle general errors
   */
  private handleError(error: Error, context: string): void {
    this.lastError = `${context}: ${error.message}`;
    this.log(context, error);
  }

  /**
   * Utility: Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Utility: Map confidence level
   */
  private mapConfidenceLevel(confidence: number): 'High' | 'Medium' | 'Low' {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  }

  /**
   * Logging utility
   */
  private log(message: string, data?: any): void {
    if (this.options.enableLogging) {
      if (data) {
        console.log(`[BackendService] ${message}`, data);
      } else {
        console.log(`[BackendService] ${message}`);
      }
    }
  }
}

// Export singleton instance for backward compatibility
export const backendService = new AeroVisionBackendService();