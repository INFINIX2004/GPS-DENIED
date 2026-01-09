import React from 'react';
import { useErrorLogger } from '../services/errorLoggingService';
import { validateAlerts } from '../utils/dataValidation';

interface Alert {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
}

interface AlertsPanelProps {
  alertLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  recentAlerts: Alert[];
}

export const AlertsPanel = React.memo(function AlertsPanel(props: AlertsPanelProps) {
  const { logWarning } = useErrorLogger();

  // Validate and sanitize alerts data
  const validatedData = React.useMemo(() => {
    try {
      return validateAlerts(props);
    } catch (error) {
      logWarning('AlertsPanel', 'Invalid alerts data received, using defaults', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        receivedData: props 
      });
      return validateAlerts(null);
    }
  }, [props, logWarning]);

  const { alertLevel, recommendation, recentAlerts } = validatedData;
  const getAlertLevelStyle = (level: string) => {
    switch (level) {
      case 'NORMAL': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'ELEVATED': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getAlertTypeIndicator = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-500';
      case 'warning': return 'bg-amber-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Alert Level */}
        <div>
          <h3 className="text-xs text-gray-500 mb-2">ALERT LEVEL</h3>
          <div className={`px-4 py-3 border-2 rounded-lg text-center ${getAlertLevelStyle(alertLevel)}`}>
            {alertLevel}
          </div>
        </div>

        {/* System Recommendation */}
        <div className="lg:col-span-2">
          <h3 className="text-xs text-gray-500 mb-2">SYSTEM RECOMMENDATION</h3>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-4 py-3 text-gray-900">
            {recommendation}
          </div>
        </div>
      </div>

      {/* Recent Alerts Timeline */}
      <div>
        <h3 className="text-xs text-gray-500 mb-3">RECENT ACTIVITY</h3>
        <div className="space-y-2">
          {recentAlerts.length === 0 ? (
            <div className="text-gray-400 text-sm py-2">No recent alerts</div>
          ) : (
            recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getAlertTypeIndicator(alert.type)}`} />
                <span className="text-gray-500 text-xs w-20 flex-shrink-0">{alert.timestamp}</span>
                <span className="text-gray-900 flex-1">{alert.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});