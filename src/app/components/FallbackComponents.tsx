import React from 'react';

/**
 * Fallback components for graceful degradation
 * Used when components fail to render or data is unavailable
 * 
 * Requirements: 6.1, 6.2, 6.3 - Graceful handling of missing/invalid data
 */

interface FallbackProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Generic fallback component for any error state
 */
export function GenericFallback({ 
  title = "Component Unavailable", 
  message = "This component is temporarily unavailable. Please try refreshing the page.",
  icon,
  actions,
  className = ""
}: FallbackProps) {
  const defaultIcon = (
    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex items-center justify-center ${className}`}>
      <div className="text-center max-w-md">
        <div className="mb-4 flex justify-center">
          {icon || defaultIcon}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        {actions && <div className="flex justify-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * Fallback for SystemStatus component when data is unavailable
 */
export function SystemStatusFallback() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <div className="w-1 h-5 bg-gray-400 rounded-full"></div>
        <h2 className="text-gray-500">System Status</h2>
        <div className="ml-auto">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Offline</div>
            <div className="text-sm text-gray-400">--</div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">System status unavailable</p>
        <p className="text-xs text-gray-400">Check system connection</p>
      </div>
    </div>
  );
}

/**
 * Fallback for IntruderList component when no data or error occurs
 */
export function IntruderListFallback({ reason = "error" }: { reason?: "error" | "no-data" | "offline" }) {
  const getContent = () => {
    switch (reason) {
      case "no-data":
        return {
          icon: (
            <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: "No Active Threats",
          message: "All clear - no intruders detected in monitored zones.",
          color: "text-green-600"
        };
      case "offline":
        return {
          icon: (
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75A9.75 9.75 0 0012 2.25z" />
            </svg>
          ),
          title: "System Offline",
          message: "Unable to detect threats - camera or processing system is offline.",
          color: "text-gray-600"
        };
      default:
        return {
          icon: (
            <svg className="w-12 h-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          title: "Detection Unavailable",
          message: "Threat detection is temporarily unavailable. Attempting to reconnect...",
          color: "text-amber-600"
        };
    }
  };

  const content = getContent();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
        <div className="w-1 h-5 bg-gray-400 rounded-full"></div>
        <h2 className="text-gray-500">Active Intruders</h2>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            {content.icon}
          </div>
          <h3 className={`text-lg font-medium mb-2 ${content.color}`}>
            {content.title}
          </h3>
          <p className="text-gray-500 text-sm max-w-xs">
            {content.message}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback for ThreatIntelligence component when no intruder is selected or data is unavailable
 */
export function ThreatIntelligenceFallback({ 
  reason = "no-selection" 
}: { 
  reason?: "no-selection" | "no-data" | "error" | "offline" 
}) {
  const getContent = () => {
    switch (reason) {
      case "no-selection":
        return {
          icon: (
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: "Select an Intruder",
          message: "Choose an intruder from the list to view detailed threat intelligence and behavioral analysis."
        };
      case "no-data":
        return {
          icon: (
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          title: "No Intelligence Data",
          message: "Threat intelligence data is not available for the selected intruder."
        };
      case "offline":
        return {
          icon: (
            <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364" />
            </svg>
          ),
          title: "Analysis Offline",
          message: "Threat intelligence analysis is offline. Unable to provide behavioral predictions."
        };
      default:
        return {
          icon: (
            <svg className="w-12 h-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          title: "Intelligence Error",
          message: "Unable to load threat intelligence data. Please try again."
        };
    }
  };

  const content = getContent();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex items-center justify-center" style={{ minHeight: '400px' }}>
      <div className="text-center max-w-sm">
        <div className="mb-4 flex justify-center">
          {content.icon}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {content.title}
        </h3>
        <p className="text-gray-500 text-sm">
          {content.message}
        </p>
      </div>
    </div>
  );
}

/**
 * Fallback for AlertsPanel component when data is unavailable
 */
export function AlertsPanelFallback() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Alert Level */}
        <div>
          <h3 className="text-xs text-gray-400 mb-2">ALERT LEVEL</h3>
          <div className="px-4 py-3 border-2 border-gray-200 rounded-lg text-center bg-gray-50">
            <span className="text-gray-400">UNKNOWN</span>
          </div>
        </div>

        {/* System Recommendation */}
        <div className="lg:col-span-2">
          <h3 className="text-xs text-gray-400 mb-2">SYSTEM RECOMMENDATION</h3>
          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg px-4 py-3 text-gray-400">
            System offline - unable to provide recommendations
          </div>
        </div>
      </div>

      {/* Recent Alerts Timeline */}
      <div>
        <h3 className="text-xs text-gray-400 mb-3">RECENT ACTIVITY</h3>
        <div className="text-center py-8">
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 text-sm">No alert data available</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback for VideoFeed component when stream is unavailable
 */
export function VideoFeedFallback({ 
  reason = "offline",
  onRetry
}: { 
  reason?: "offline" | "error" | "connecting" | "no-camera";
  onRetry?: () => void;
}) {
  const getContent = () => {
    switch (reason) {
      case "connecting":
        return {
          icon: (
            <div className="w-16 h-16 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
          ),
          title: "Connecting...",
          message: "Establishing connection to video stream",
          showRetry: false
        };
      case "no-camera":
        return {
          icon: (
            <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
            </svg>
          ),
          title: "Camera Offline",
          message: "Video camera is not connected or has lost signal",
          showRetry: true
        };
      case "error":
        return {
          icon: (
            <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          title: "Stream Error",
          message: "Unable to load video stream. Please check connection.",
          showRetry: true
        };
      default:
        return {
          icon: (
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
          title: "Video Offline",
          message: "Live video feed is currently unavailable",
          showRetry: true
        };
    }
  };

  const content = getContent();

  return (
    <div className="bg-gray-900 rounded-lg h-full flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          {content.icon}
        </div>
        <h3 className="text-lg font-medium text-white mb-2">
          {content.title}
        </h3>
        <p className="text-gray-400 text-sm mb-4 max-w-xs">
          {content.message}
        </p>
        {content.showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading fallback component for components that are still loading data
 */
export function LoadingFallback({ 
  title = "Loading...",
  message = "Please wait while we load the data"
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </div>
  );
}