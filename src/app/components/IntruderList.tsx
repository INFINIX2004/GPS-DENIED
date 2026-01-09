import React from 'react';
import { useErrorLogger } from '../services/errorLoggingService';
import { validateIntruders } from '../utils/dataValidation';

export interface Intruder {
  trackId: string;
  zone: 'PUBLIC' | 'BUFFER' | 'RESTRICTED' | 'CRITICAL';
  threatScore: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timeSinceDetection: number;
}

interface IntruderListProps {
  intruders: Intruder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const IntruderList = React.memo(function IntruderList({ intruders, selectedId, onSelect }: IntruderListProps) {
  const { logWarning, logError } = useErrorLogger();

  // Validate and sanitize intruders data
  const validatedIntruders = React.useMemo(() => {
    try {
      return validateIntruders(intruders);
    } catch (error) {
      logWarning('IntruderList', 'Invalid intruders data received, using empty array', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        receivedData: intruders 
      });
      return [];
    }
  }, [intruders, logWarning]);

  // Safe selection handler
  const handleSelect = React.useCallback((id: string) => {
    try {
      if (validatedIntruders.find(intruder => intruder.trackId === id)) {
        onSelect(id);
      } else {
        logWarning('IntruderList', 'Attempted to select non-existent intruder', { 
          selectedId: id,
          availableIds: validatedIntruders.map(i => i.trackId) 
        });
      }
    } catch (error) {
      logError('IntruderList', 'Error in intruder selection', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        selectedId: id 
      });
    }
  }, [validatedIntruders, onSelect, logWarning, logError]);
  const getZoneStyle = (zone: string) => {
    switch (zone) {
      case 'PUBLIC': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'BUFFER': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'RESTRICTED': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'CRITICAL': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getThreatLevelStyle = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-blue-600 text-white';
      case 'MEDIUM': return 'bg-amber-600 text-white';
      case 'HIGH': return 'bg-orange-600 text-white';
      case 'CRITICAL': return 'bg-red-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const formatTime = (seconds: number) => {
    try {
      if (typeof seconds !== 'number' || seconds < 0) {
        return '0s';
      }
      if (seconds < 60) return `${Math.round(seconds)}s`;
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    } catch (error) {
      logWarning('IntruderList', 'Error formatting time', { seconds });
      return '0s';
    }
  };

  const highestThreatId = React.useMemo(() => {
    try {
      return validatedIntruders.length > 0 
        ? validatedIntruders.reduce((max, intruder) => 
            intruder.threatScore > max.threatScore ? intruder : max
          ).trackId
        : null;
    } catch (error) {
      logWarning('IntruderList', 'Error finding highest threat', { intrudersCount: validatedIntruders.length });
      return null;
    }
  }, [validatedIntruders, logWarning]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
        <h2 className="text-gray-900">Active Intruders</h2>
      </div>
      
      {validatedIntruders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          No active threats detected
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto flex-1">
          {validatedIntruders.map((intruder) => {
            const isHighest = intruder.trackId === highestThreatId;
            const isSelected = intruder.trackId === selectedId;
            
            return (
              <div
                key={intruder.trackId}
                onClick={() => handleSelect(intruder.trackId)}
                className={`
                  rounded-lg p-4 cursor-pointer transition-all border-2
                  ${isHighest ? 'border-red-500 shadow-md' : 'border-gray-200'}
                  ${isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white hover:bg-gray-50'}
                `}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-gray-900 mb-2">{intruder.trackId}</div>
                    <div className={`inline-flex px-2 py-1 rounded-md text-xs border ${getZoneStyle(intruder.zone)}`}>
                      {intruder.zone}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl text-gray-900">{intruder.threatScore}</div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-md text-xs ${getThreatLevelStyle(intruder.threatLevel)}`}>
                    {intruder.threatLevel}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(intruder.timeSinceDetection)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});