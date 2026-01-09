import React from 'react';
import { useErrorLogger } from '../services/errorLoggingService';
import { validateSingleThreatIntelligence } from '../utils/dataValidation';

interface ThreatBreakdown {
  factor: string;
  score: number;
}

interface BehavioralAnalysis {
  loitering: boolean;
  loiteringDuration?: number;
  speedAnomaly: boolean;
  trajectoryStability: 'Stable' | 'Moderate' | 'Erratic';
  trajectoryConfidence: number;
}

interface Prediction {
  nearTerm: string;
  mediumTerm: string;
  farTerm: string;
  confidence: 'High' | 'Medium' | 'Low';
  willEnterRestricted: boolean;
}

interface ThreatIntelligenceProps {
  trackId: string;
  threatBreakdown: ThreatBreakdown[];
  behavioral: BehavioralAnalysis;
  prediction: Prediction;
}

export const ThreatIntelligence = React.memo(function ThreatIntelligence(props: ThreatIntelligenceProps) {
  const { logWarning } = useErrorLogger();

  // Validate and sanitize threat intelligence data
  const validatedData = React.useMemo(() => {
    try {
      const validated = validateSingleThreatIntelligence({
        threatBreakdown: props.threatBreakdown,
        behavioral: props.behavioral,
        prediction: props.prediction
      });
      
      if (!validated) {
        throw new Error('Validation returned null');
      }
      
      return {
        trackId: props.trackId || 'Unknown',
        ...validated
      };
    } catch (error) {
      logWarning('ThreatIntelligence', 'Invalid threat intelligence data, using defaults', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        trackId: props.trackId,
        receivedData: props 
      });
      
      // Return safe defaults
      return {
        trackId: props.trackId || 'Unknown',
        threatBreakdown: [],
        behavioral: {
          loitering: false,
          speedAnomaly: false,
          trajectoryStability: 'Stable' as const,
          trajectoryConfidence: 0
        },
        prediction: {
          nearTerm: 'No prediction available',
          mediumTerm: 'No prediction available',
          farTerm: 'No prediction available',
          confidence: 'Low' as const,
          willEnterRestricted: false
        }
      };
    }
  }, [props, logWarning]);

  const { trackId, threatBreakdown, behavioral, prediction } = validatedData;
  const getConfidenceStyle = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'text-emerald-700 bg-emerald-50';
      case 'Medium': return 'text-amber-700 bg-amber-50';
      case 'Low': return 'text-orange-700 bg-orange-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const totalScore = React.useMemo(() => {
    try {
      return threatBreakdown.reduce((sum, item) => {
        const score = typeof item.score === 'number' ? item.score : 0;
        return sum + score;
      }, 0);
    } catch (error) {
      logWarning('ThreatIntelligence', 'Error calculating total score', { threatBreakdown });
      return 0;
    }
  }, [threatBreakdown, logWarning]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
        <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
        <h2 className="text-gray-900">Threat Intelligence</h2>
        <span className="ml-auto text-sm text-gray-500">{trackId}</span>
      </div>
      
      {/* Threat Score Breakdown */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-gray-700">Threat Score Breakdown</h3>
          <div className="text-xl text-gray-900">Total: {totalScore}</div>
        </div>
        <div className="space-y-2">
          {threatBreakdown.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex-1 flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700">{item.factor}</span>
                <span className={`text-sm ${item.score > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {item.score > 0 ? '+' : ''}{item.score}
                </span>
              </div>
              {item.score > 0 && (
                <div 
                  className="h-2 bg-red-500 rounded-full" 
                  style={{ width: `${Math.min(item.score * 2, 60)}px` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Behavioral Analysis */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm text-gray-700 mb-4">Behavioral Analysis</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Loitering</div>
            <div className={`text-sm ${behavioral.loitering ? 'text-red-600' : 'text-emerald-600'}`}>
              {behavioral.loitering ? 'DETECTED' : 'NO'}
              {behavioral.loitering && behavioral.loiteringDuration && 
                ` (${behavioral.loiteringDuration}s)`
              }
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Speed Anomaly</div>
            <div className={`text-sm ${behavioral.speedAnomaly ? 'text-amber-600' : 'text-emerald-600'}`}>
              {behavioral.speedAnomaly ? 'DETECTED' : 'NORMAL'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Trajectory</div>
            <div className="text-sm text-gray-900">
              {behavioral.trajectoryStability}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Confidence</div>
            <div className="text-sm text-gray-900">{behavioral.trajectoryConfidence}%</div>
          </div>
        </div>
      </div>

      {/* Prediction Summary */}
      <div>
        <h3 className="text-sm text-gray-700 mb-4">Trajectory Prediction</h3>
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              <div className="text-xs text-blue-700">Near-term (3s)</div>
            </div>
            <div className="text-sm text-gray-900 ml-4">{prediction.nearTerm}</div>
          </div>
          
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
              <div className="text-xs text-indigo-700">Medium-term (6s)</div>
            </div>
            <div className="text-sm text-gray-900 ml-4">{prediction.mediumTerm}</div>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              <div className="text-xs text-purple-700">Far-term (10s)</div>
            </div>
            <div className="text-sm text-gray-900 ml-4">{prediction.farTerm}</div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Confidence Level</div>
              <div className={`inline-flex px-2 py-1 rounded-md text-sm ${getConfidenceStyle(prediction.confidence)}`}>
                {prediction.confidence}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Restricted Entry</div>
              <div className={`text-sm ${prediction.willEnterRestricted ? 'text-red-600' : 'text-emerald-600'}`}>
                {prediction.willEnterRestricted ? 'LIKELY' : 'UNLIKELY'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});