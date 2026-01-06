// AeroVision Data Service
// Handles real-time data from AeroVision system via API/WebSocket

export interface AeroVisionSystemData {
  power_mode: 'IDLE' | 'ACTIVE' | 'ALERT';
  power_w: number;
  battery_minutes: number;
  fps: number;
  camera_status: 'CONNECTED' | 'DISCONNECTED';
  timestamp: string;
}

export interface AeroVisionTrack {
  id: number;
  zone: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
  threat_score: number;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detection_time: number;
  behavior: {
    loitering: {
      active: boolean;
      duration?: number;
    };
    speed_anomaly: boolean;
    trajectory_confidence: number;
  };
  prediction: {
    near: { zone: string; confidence: number };
    medium: { zone: string; confidence: number };
    far: { zone: string; confidence: number };
  };
  explanation: Array<{
    factor: string;
    points: number;
  }>;
}

export interface AeroVisionAlert {
  time: string;
  message: string;
  level: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AeroVisionData {
  system: AeroVisionSystemData;
  tracks: AeroVisionTrack[];
  alerts: AeroVisionAlert[];
}

export class AeroVisionService {
  private ws: WebSocket | null = null;
  private listeners: Array<(data: AeroVisionData) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;

  constructor(private wsUrl?: string, private apiUrl?: string) {
    // Default URLs - replace with actual AeroVision endpoints
    this.wsUrl = wsUrl || 'ws://localhost:8080/aerovision/stream';
    this.apiUrl = apiUrl || 'http://localhost:8080/aerovision/data';
  }

  // Subscribe to real-time data updates
  subscribe(callback: (data: AeroVisionData) => void): () => void {
    this.listeners.push(callback);
    
    // Start connection if not already connected
    if (!this.isConnected) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
      if (this.listeners.length === 0) {
        this.disconnect();
      }
    };
  }

  // Connect to AeroVision WebSocket stream
  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl!);
      
      this.ws.onopen = () => {
        console.log('Connected to AeroVision stream');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data: AeroVisionData = JSON.parse(event.data);
          this.notifyListeners(data);
        } catch (error) {
          console.error('Failed to parse AeroVision data:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from AeroVision stream');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('AeroVision WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect to AeroVision:', error);
      this.attemptReconnect();
    }
  }

  // Attempt to reconnect with exponential backoff
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Falling back to polling.');
      this.startPolling();
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  // Fallback to HTTP polling if WebSocket fails
  private startPolling(): void {
    const pollInterval = setInterval(async () => {
      if (this.listeners.length === 0) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const data = await this.fetchData();
        if (data) {
          this.notifyListeners(data);
        }
      } catch (error) {
        console.error('Failed to poll AeroVision data:', error);
      }
    }, 200); // 5 Hz polling
  }

  // Fetch data via HTTP API
  private async fetchData(): Promise<AeroVisionData | null> {
    try {
      const response = await fetch(this.apiUrl!);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch AeroVision data:', error);
      return null;
    }
  }

  // Notify all listeners of new data
  private notifyListeners(data: AeroVisionData): void {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in AeroVision data listener:', error);
      }
    });
  }

  // Disconnect from AeroVision
  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  // Get connection status
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CONNECTING: return 'connecting';
      default: return 'disconnected';
    }
  }

  // Manual data refresh
  async refresh(): Promise<AeroVisionData | null> {
    return await this.fetchData();
  }
}

// Singleton instance
export const aeroVisionService = new AeroVisionService();