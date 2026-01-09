import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SystemStatus } from './components/SystemStatus';
import { IntruderList, Intruder } from './components/IntruderList';
import { ThreatIntelligence } from './components/ThreatIntelligence';
import { AlertsPanel } from './components/AlertsPanel';
import { VideoFeed } from './components/VideoFeed';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  SystemStatusFallback, 
  IntruderListFallback, 
  ThreatIntelligenceFallback,
  AlertsPanelFallback,
  VideoFeedFallback 
} from './components/FallbackComponents';
import { useAeroVision } from './hooks/useAeroVision';
import { SystemState } from './types/systemState';
import { validateSystemState, isEmptyState, getFallbackReason } from './utils/dataValidation';
import { errorLoggingService, useErrorLogger } from './services/errorLoggingService';
import aeroVisionConfig from './config/aeroVisionConfig';

export default function App() {
  const [selectedIntruderId, setSelectedIntruderId] = useState<string | null>(null);
  const { logError, logWarning, logInfo } = useErrorLogger();
  
  // Use AeroVision hook with SystemStateManager enabled
  const { 
    systemState, 
    connectionStatus, 
    error, 
    refresh, 
    isConnected,
    usingSystemStateManager 
  } = useAeroVision({
    useMockData: aeroVisionConfig.useMockData,
    mockUpdateInterval: aeroVisionConfig.mockUpdateInterval,
    useSystemStateManager: true // Always use the new SystemStateManager
  });

  // Validate and sanitize system state data
  const currentSystemState: SystemState = useMemo(() => {
    try {
      return validateSystemState(systemState);
    } catch (validationError) {
      logError('App', 'Failed to validate system state', { 
        error: validationError instanceof Error ? validationError.message : 'Unknown error',
        rawData: systemState 
      });
      return validateSystemState(null); // Return default state
    }
  }, [systemState, logError]);

  // Get system state analysis for fallback decisions
  const stateAnalysis = useMemo(() => isEmptyState(currentSystemState), [currentSystemState]);

  // Log connection errors
  useEffect(() => {
    if (error) {
      logError('App', `Connection error: ${error}`, { 
        connectionStatus,
        usingSystemStateManager 
      });
    }
  }, [error, connectionStatus, usingSystemStateManager, logError]);

  // Error handler for component errors
  const handleComponentError = useCallback((error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
    errorLoggingService.logComponentError('App', error, errorInfo, errorId);
  }, []);

  // Auto-select highest threat intruder when enabled
  useEffect(() => {
    try {
      if (aeroVisionConfig.autoSelectHighestThreat && currentSystemState.intruders.length > 0) {
        const highestThreat = currentSystemState.intruders.reduce((max, intruder) => 
          intruder.threatScore > max.threatScore ? intruder : max
        );
        
        if (!selectedIntruderId || !currentSystemState.intruders.find(i => i.trackId === selectedIntruderId)) {
          setSelectedIntruderId(highestThreat.trackId);
        }
      } else if (currentSystemState.intruders.length === 0) {
        setSelectedIntruderId(null);
      }
    } catch (selectionError) {
      logWarning('App', 'Error in intruder auto-selection', { 
        error: selectionError instanceof Error ? selectionError.message : 'Unknown error',
        intrudersCount: currentSystemState.intruders.length 
      });
    }
  }, [currentSystemState.intruders, selectedIntruderId, logWarning]);

  // Get selected intruder and threat intelligence with error handling
  const selectedIntruder = useMemo(() => {
    try {
      return currentSystemState.intruders.find(i => i.trackId === selectedIntruderId) || null;
    } catch (error) {
      logWarning('App', 'Error finding selected intruder', { selectedIntruderId });
      return null;
    }
  }, [currentSystemState.intruders, selectedIntruderId, logWarning]);

  const selectedIntelligence = useMemo(() => {
    try {
      return selectedIntruderId ? currentSystemState.threatIntelligence[selectedIntruderId] || null : null;
    } catch (error) {
      logWarning('App', 'Error getting threat intelligence', { selectedIntruderId });
      return null;
    }
  }, [selectedIntruderId, currentSystemState.threatIntelligence, logWarning]);

  // Memoized handlers for better performance
  const handleVideoStreamError = useCallback((error: Error) => {
    logError('VideoFeed', `Stream error: ${error.message}`, { error: error.stack });
  }, [logError]);

  const handleVideoStreamLoad = useCallback(() => {
    logInfo('VideoFeed', 'Video stream loaded successfully');
  }, [logInfo]);

  const handleIntruderSelect = useCallback((id: string) => {
    setSelectedIntruderId(id);
  }, []);

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
                  currentSystemState.systemStatus.cameraStatus === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'
                }`}></div>
                <span className="text-xs text-gray-500">
                  Camera {currentSystemState.systemStatus.cameraStatus === 'Connected' ? 'Online' : 'Offline'}
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
        <ErrorBoundary
          componentName="SystemStatus"
          onError={handleComponentError}
          fallback={<SystemStatusFallback />}
        >
          <SystemStatus {...currentSystemState.systemStatus} />
        </ErrorBoundary>
      </div>

      {/* Video and Threat Overview - Side by Side */}
      <div className="flex gap-4 mb-4">
        {/* Left - Video Feed (640x640) */}
        <div style={{ width: '640px', height: '640px', flexShrink: 0 }}>
          <ErrorBoundary
            componentName="VideoFeed"
            onError={handleComponentError}
            fallback={
              <VideoFeedFallback 
                reason={getFallbackReason(currentSystemState, 'video')} 
                onRetry={refresh}
              />
            }
          >
            <VideoFeed 
              {...currentSystemState.videoStatus}
              enableWebcam={true}
              fallbackToPlaceholder={true}
              onStreamError={handleVideoStreamError}
              onStreamLoad={handleVideoStreamLoad}
            />
          </ErrorBoundary>
        </div>

        {/* Right - Threat Overview (Intruder List) */}
        <div style={{ flex: 1, height: '640px' }}>
          <ErrorBoundary
            componentName="IntruderList"
            onError={handleComponentError}
            fallback={
              <IntruderListFallback 
                reason={getFallbackReason(currentSystemState, 'intruders')} 
              />
            }
          >
            <IntruderList
              intruders={currentSystemState.intruders}
              selectedId={selectedIntruderId}
              onSelect={handleIntruderSelect}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* Bottom Section - Threat Intelligence and Alerts */}
      <div className="flex gap-4 mb-4">
        {/* Threat Intelligence */}
        <div style={{ width: '640px', flexShrink: 0 }}>
          <ErrorBoundary
            componentName="ThreatIntelligence"
            onError={handleComponentError}
            fallback={
              <ThreatIntelligenceFallback 
                reason={getFallbackReason(currentSystemState, 'threat-intelligence')} 
              />
            }
          >
            {selectedIntelligence && selectedIntruder ? (
              <ThreatIntelligence
                trackId={selectedIntruder.trackId}
                threatBreakdown={selectedIntelligence.threatBreakdown}
                behavioral={selectedIntelligence.behavioral}
                prediction={selectedIntelligence.prediction}
              />
            ) : (
              <ThreatIntelligenceFallback 
                reason={
                  !stateAnalysis.isSystemOnline ? 'offline' :
                  !stateAnalysis.hasIntruders ? 'no-selection' :
                  'no-data'
                }
              />
            )}
          </ErrorBoundary>
        </div>

        {/* Alerts Panel */}
        <div style={{ flex: 1 }}>
          <ErrorBoundary
            componentName="AlertsPanel"
            onError={handleComponentError}
            fallback={<AlertsPanelFallback />}
          >
            <AlertsPanel {...currentSystemState.alerts} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}