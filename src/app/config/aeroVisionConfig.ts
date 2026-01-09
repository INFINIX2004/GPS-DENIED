// AeroVision Configuration
// Modify these settings to connect to your real AeroVision system

export const aeroVisionConfig = {
  // Data source configuration
  useMockData: true, // Set to false when connecting to real AeroVision system
  
  // Real AeroVision endpoints (update with your actual URLs)
  websocketUrl: 'ws://localhost:8080/aerovision/stream',
  apiUrl: 'http://localhost:8080/aerovision/data',
  
  // Update intervals
  mockUpdateInterval: 200, // 5 Hz for mock data
  realDataTimeout: 5000, // Timeout for real data requests
  
  // Connection settings
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  
  // UI settings
  autoSelectHighestThreat: true,
  showConnectionStatus: true,
  enableManualRefresh: true,
  
  // Development settings
  enableDebugLogs: false,
  mockDataVariation: true, // Add randomness to mock data
};

// Environment-based configuration
if (process.env.NODE_ENV === 'production') {
  // Production settings
  aeroVisionConfig.useMockData = false;
  aeroVisionConfig.enableDebugLogs = false;
  aeroVisionConfig.websocketUrl = process.env.REACT_APP_AEROVISION_WS_URL || aeroVisionConfig.websocketUrl;
  aeroVisionConfig.apiUrl = process.env.REACT_APP_AEROVISION_API_URL || aeroVisionConfig.apiUrl;
}

export default aeroVisionConfig;