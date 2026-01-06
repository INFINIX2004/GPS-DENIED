import React, { useState, useEffect } from 'react';
import { SystemStatus } from './components/SystemStatus';
import { IntruderList, Intruder } from './components/IntruderList';
import { ThreatIntelligence } from './components/ThreatIntelligence';
import { AlertsPanel } from './components/AlertsPanel';
import { VideoFeed } from './components/VideoFeed';
import { useAeroVision } from './hooks/useAeroVision';
import { AeroVisionData, AeroVisionTrack } from './services/aeroVisionService';
import aeroVisionConfig from './config/aeroVisionConfig';

// Convert AeroVision data to dashboard format
function convertAeroVisionData(data: AeroVisionData) {
  // Convert system status
  const systemStatus = {
    powerMode: data.system.power_mode,
    powerConsumption: data.system.power_w,
    batteryRemaining: data.system.battery_minutes,
    fps: data.system.fps,
    processingStatus: 'Normal',
    cameraStatus: data.system.camera_status === 'CONNECTED' ? 'Connected' as const : 'Lost' as const,
    timestamp: data.system.timestamp
  };

  // Convert tracks to intruders
  const intruders: Intruder[] = data.tracks.map(track => ({
    trackId: `TRK-${track.id.toString().padStart(3, '0')}`,
    zone: track.zone,
    threatScore: track.threat_score,
    threatLevel: track.threat_level,
    timeSinceDetection: track.detection_time
  }));

  // Convert threat intelligence
  const threatIntelligence: Record<string, any> = {};
  data.tracks.forEach(track => {
    const trackId = `TRK-${track.id.toString().padStart(3, '0')}`;
    
    // Determine trajectory stability based on confidence
    let trajectoryStability: 'Stable' | 'Moderate' | 'Erratic';
    if (track.behavior.trajectory_confidence >= 0.8) trajectoryStability = 'Stable';
    else if (track.behavior.trajectory_confidence >= 0.6) trajectoryStability = 'Moderate';
    else trajectoryStability = 'Erratic';

    // Determine prediction confidence
    let predictionConfidence: 'High' | 'Medium' | 'Low';
    const avgConfidence = (track.prediction.near.confidence + track.prediction.medium.confidence + track.prediction.far.confidence) / 3;
    if (avgConfidence >= 0.7) predictionConfidence = 'High';
    else if (avgConfidence >= 0.5) predictionConfidence = 'Medium';
    else predictionConfidence = 'Low';

    threatIntelligence[trackId] = {
      threatBreakdown: track.explanation.map(exp => ({
        factor: exp.factor,
        score: exp.points
      })),
      behavioral: {
        loitering: track.behavior.loitering.active,
        loiteringDuration: track.behavior.loitering.duration,
        speedAnomaly: track.behavior.speed_anomaly,
        trajectoryStability,
        trajectoryConfidence: Math.round(track.behavior.trajectory_confidence * 100)
      },
      prediction: {
        nearTerm: `Predicted to move to ${track.prediction.near.zone} zone`,
        mediumTerm: `Expected to reach ${track.prediction.medium.zone} zone`,
        farTerm: `Long-term trajectory toward ${track.prediction.far.zone} zone`,
        confidence: predictionConfidence,
        willEnterRestricted: track.prediction.far.zone === 'RESTRICTED' || track.prediction.far.zone === 'CRITICAL'
      }
    };
  });

  // Determine overall alert level
  let alertLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'NORMAL';
  const maxThreatScore = Math.max(...data.tracks.map(t => t.threat_score), 0);
  if (maxThreatScore >= 80) alertLevel = 'CRITICAL';
  else if (maxThreatScore >= 60) alertLevel = 'HIGH';
  else if (maxThreatScore >= 40) alertLevel = 'ELEVATED';

  // Generate recommendation
  let recommendation = 'System operating normally - Continue monitoring';
  if (alertLevel === 'CRITICAL') {
    recommendation = 'IMMEDIATE ACTION REQUIRED - Deploy security response team';
  } else if (alertLevel === 'HIGH') {
    recommendation = 'Dispatch patrol unit - Monitor high-threat targets closely';
  } else if (alertLevel === 'ELEVATED') {
    recommendation = 'Increase monitoring frequency - Prepare response team';
  }

  // Convert alerts
  const alerts = {
    alertLevel,
    recommendation,
    recentAlerts: data.alerts.map((alert, index) => ({
      id: `A${index + 1}`,
      timestamp: alert.time,
      message: alert.message,
      type: alert.level === 'CRITICAL' ? 'critical' as const : 
            alert.level === 'WARNING' ? 'warning' as const : 'info' as const
    }))
  };

  return { systemStatus, intruders, threatIntelligence, alerts };
}

export default function App() {
  const [selectedIntruderId, setSelectedIntruderId] = useState<string | null>(null);
  
  // Use AeroVision hook with configuration
  const { data: aeroVisionData, connectionStatus, error, refresh, isConnected } = useAeroVision({
    useMockData: aeroVisionConfig.useMockData,
    mockUpdateInterval: aeroVisionConfig.mockUpdateInterval
  });

  const [dashboardData, setDashboardData] = useState(convertAeroVisionData(aeroVisionData));

  // Convert AeroVision data to dashboard format whenever it updates
  useEffect(() => {
    const converted = convertAeroVisionData(aeroVisionData);
    setDashboardData(converted);
    
    // Auto-select highest threat if enabled and no selection or if selected track no longer exists
    if (aeroVisionConfig.autoSelectHighestThreat && converted.intruders.length > 0) {
      const highestThreat = converted.intruders.reduce((max, intruder) => 
        intruder.threatScore > max.threatScore ? intruder : max
      );
      
      if (!selectedIntruderId || !converted.intruders.find(i => i.trackId === selectedIntruderId)) {
        setSelectedIntruderId(highestThreat.trackId);
      }
    } else {
      setSelectedIntruderId(null);
    }
  }, [aeroVisionData, selectedIntruderId]);

  // Handle empty states
  const selectedIntruder = dashboardData.intruders.find(i => i.trackId === selectedIntruderId);
  const selectedIntelligence = selectedIntruderId 
    ? dashboardData.threatIntelligence[selectedIntruderId]
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      {/* Header */}
      <div className="mb-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl text-gray-900">AeroVision</h1>
              <p className="text-xs text-gray-500">Drone-Based Intelligent Surveillance System</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              {aeroVisionConfig.showConnectionStatus && (
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                    connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                    'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600">
                    {connectionStatus === 'connected' ? 'System Active' :
                     connectionStatus === 'connecting' ? 'Connecting...' :
                     'System Offline'}
                  </span>
                </div>
              )}
              
              {/* Camera Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  aeroVisionData.system.camera_status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-red-500'
                }`}></div>
                <span className="text-xs text-gray-500">
                  Camera {aeroVisionData.system.camera_status === 'CONNECTED' ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Manual Refresh */}
              {aeroVisionConfig.enableManualRefresh && (
                <button
                  onClick={refresh}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
          
          {/* Error Display */}
          {error && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1 rounded">
              Error: {error}
            </div>
          )}
        </div>
      </div>

      {/* System Status - Horizontal Top */}
      <div className="mb-4">
        <SystemStatus {...dashboardData.systemStatus} />
      </div>

      {/* Video and Threat Overview - Side by Side */}
      <div className="flex gap-4 mb-4">
        {/* Left - Video Feed (640x640) */}
        <div style={{ width: '640px', height: '640px', flexShrink: 0 }}>
          <VideoFeed 
            isLive={aeroVisionData.system.camera_status === 'CONNECTED'} 
            resolution="1920x1080" 
            latency={45} 
          />
        </div>

        {/* Right - Threat Overview (Intruder List) */}
        <div style={{ flex: 1, height: '640px' }}>
          <IntruderList
            intruders={dashboardData.intruders}
            selectedId={selectedIntruderId}
            onSelect={setSelectedIntruderId}
          />
        </div>
      </div>

      {/* Bottom Section - Threat Intelligence and Alerts */}
      <div className="flex gap-4 mb-4">
        {/* Threat Intelligence */}
        <div style={{ width: '640px', flexShrink: 0 }}>
          {selectedIntelligence && selectedIntruder ? (
            <ThreatIntelligence
              trackId={selectedIntruder.trackId}
              threatBreakdown={selectedIntelligence.threatBreakdown}
              behavioral={selectedIntelligence.behavioral}
              prediction={selectedIntelligence.prediction}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex items-center justify-center" style={{ minHeight: '400px' }}>
              <div className="text-center">
                <div className="text-gray-400 mb-2">
                  {dashboardData.intruders.length === 0 ? 'No active threats detected' : 'Select an intruder to view threat intelligence'}
                </div>
                {aeroVisionData.system.camera_status !== 'CONNECTED' && (
                  <div className="text-red-500 text-sm">Camera offline - Unable to detect threats</div>
                )}
                {connectionStatus !== 'connected' && (
                  <div className="text-amber-500 text-sm">System disconnected - Attempting to reconnect</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alerts Panel */}
        <div style={{ flex: 1 }}>
          <AlertsPanel {...dashboardData.alerts} />
        </div>
      </div>
    </div>
  );
}