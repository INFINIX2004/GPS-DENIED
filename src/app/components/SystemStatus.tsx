import React from 'react';
import { useErrorLogger } from '../services/errorLoggingService';
import { validateSystemStatus } from '../utils/dataValidation';

interface SystemStatusProps {
  powerMode: 'IDLE' | 'ACTIVE' | 'ALERT';
  powerConsumption: number;
  batteryRemaining: number;
  fps: number;
  processingStatus: string;
  cameraStatus: 'Connected' | 'Lost';
  timestamp: string;
}

export const SystemStatus = React.memo(function SystemStatus(props: SystemStatusProps) {
  const { logWarning } = useErrorLogger();

  // Validate and sanitize props
  const validatedProps = React.useMemo(() => {
    try {
      return validateSystemStatus(props);
    } catch (error) {
      logWarning('SystemStatus', 'Invalid props received, using defaults', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        receivedProps: props 
      });
      return validateSystemStatus(null);
    }
  }, [props, logWarning]);

  const {
    powerMode,
    powerConsumption,
    batteryRemaining,
    fps,
    processingStatus,
    cameraStatus,
    timestamp
  } = validatedProps;
  const getPowerModeColor = (mode: string) => {
    switch (mode) {
      case 'IDLE': return 'text-gray-500 bg-gray-50';
      case 'ACTIVE': return 'text-emerald-700 bg-emerald-50';
      case 'ALERT': return 'text-red-700 bg-red-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getBatteryColor = (remaining: number) => {
    if (remaining < 10) return 'text-red-600';
    if (remaining < 30) return 'text-amber-600';
    return 'text-emerald-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
        <h2 className="text-gray-900">System Status</h2>
      </div>
      
      <div className="grid grid-cols-7 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Power Mode</div>
          <div className={`inline-flex px-2 py-1 rounded-md text-sm ${getPowerModeColor(powerMode)}`}>
            {powerMode}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Power Draw</div>
          <div className="text-sm text-gray-900">{powerConsumption.toFixed(1)} W</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Battery</div>
          <div className={`text-sm ${getBatteryColor(batteryRemaining)}`}>
            {batteryRemaining} min
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Frame Rate</div>
          <div className="text-sm text-gray-900">{fps} fps</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Processing</div>
          <div className="text-sm text-gray-900">{processingStatus}</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Camera</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${cameraStatus === 'Connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm ${cameraStatus === 'Connected' ? 'text-emerald-700' : 'text-red-700'}`}>
              {cameraStatus}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">System Time</div>
          <div className="text-sm text-gray-900">{timestamp}</div>
        </div>
      </div>
    </div>
  );
});