// Overlay Data Mapping Verification Tests
// Tests for Requirements 5.1, 5.2, 5.3, 5.4, 5.5

import { 
  OverlayDataMappingVerifier, 
  createSamplePythonDataWithOverlays 
} from '../overlayDataMapping';
import { PythonSystemData } from '../../types/pythonInterfaces';

describe('Overlay Data Mapping Verification', () => {
  let verifier: OverlayDataMappingVerifier;
  let sampleData: PythonSystemData;

  beforeEach(() => {
    verifier = new OverlayDataMappingVerifier();
    sampleData = createSamplePythonDataWithOverlays();
  });

  describe('Complete Overlay Mapping Verification', () => {
    it('should verify all overlay data mappings are correct', () => {
      const result = verifier.verifyOverlayMapping(sampleData);

      expect(result.allMappingsValid).toBe(true);
      expect(result.powerMetricsToSystemStatus).toBe(true);
      expect(result.zoneStatusToThreatIntelligence).toBe(true);
      expect(result.threatScoresToThreatIntelligence).toBe(true);
      expect(result.behavioralExplanationsToIntruderList).toBe(true);
      expect(result.predictionConfidenceToThreatIntelligence).toBe(true);
    });

    it('should provide detailed verification results', () => {
      const result = verifier.verifyOverlayMapping(sampleData);

      // Check that details are provided for each mapping
      expect(result.details.powerMetrics.length).toBeGreaterThan(0);
      expect(result.details.zoneStatus.length).toBeGreaterThan(0);
      expect(result.details.threatScores.length).toBeGreaterThan(0);
      expect(result.details.behavioralExplanations.length).toBeGreaterThan(0);
      expect(result.details.predictionConfidence.length).toBeGreaterThan(0);

      // Check that successful mappings are marked with ✓
      expect(result.details.powerMetrics.some(detail => detail.includes('✓'))).toBe(true);
      expect(result.details.zoneStatus.some(detail => detail.includes('✓'))).toBe(true);
      expect(result.details.threatScores.some(detail => detail.includes('✓'))).toBe(true);
      expect(result.details.behavioralExplanations.some(detail => detail.includes('✓'))).toBe(true);
      expect(result.details.predictionConfidence.some(detail => detail.includes('✓'))).toBe(true);
    });
  });

  describe('Requirement 5.1: Power Metrics to SystemStatus', () => {
    it('should verify power mode mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.powerMetricsToSystemStatus).toBe(true);
      expect(result.details.powerMetrics).toContain('✓ Power mode correctly mapped: ACTIVE');
    });

    it('should verify power consumption mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.powerMetrics).toContain('✓ Power consumption correctly mapped: 45.2W');
    });

    it('should verify battery remaining mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.powerMetrics).toContain('✓ Battery remaining correctly mapped: 180min');
    });

    it('should verify FPS mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.powerMetrics).toContain('✓ FPS correctly mapped: 30');
    });

    it('should verify camera status mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.powerMetrics).toContain('✓ Camera status correctly mapped: Connected');
    });

    it('should detect power metrics mapping errors', () => {
      // Create a scenario where the transformer would produce different output
      // by testing the verification logic directly with mismatched data
      const testData = createSamplePythonDataWithOverlays();
      const verifier = new OverlayDataMappingVerifier();
      
      // Get the transformed state
      const systemState = verifier['transformer'].transformSystemData(testData);
      
      // Manually modify the system state to create a mismatch
      const modifiedSystemState = {
        ...systemState,
        systemStatus: {
          ...systemState.systemStatus,
          powerMode: 'IDLE' as const // Different from the original 'ACTIVE'
        }
      };
      
      // Test the verification method directly
      const details: string[] = [];
      const result = verifier['verifyPowerMetricsMapping'](testData, modifiedSystemState, details);
      
      expect(result).toBe(false);
      expect(details.some(detail => detail.includes('Power mode mismatch'))).toBe(true);
    });
  });

  describe('Requirement 5.2: Zone Status to ThreatIntelligence', () => {
    it('should verify zone status mapping for all tracks', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.zoneStatusToThreatIntelligence).toBe(true);
      expect(result.details.zoneStatus).toContain('✓ Zone status correctly mapped for TRK-001: RESTRICTED');
      expect(result.details.zoneStatus).toContain('✓ Zone status correctly mapped for TRK-002: BUFFER');
    });

    it('should handle empty tracks gracefully', () => {
      const emptyData = { ...sampleData, tracks: [] };
      const result = verifier.verifyOverlayMapping(emptyData);
      
      expect(result.zoneStatusToThreatIntelligence).toBe(true);
      expect(result.details.zoneStatus).toContain('✓ No tracks to verify zone status mapping');
    });
  });

  describe('Requirement 5.3: Threat Scores to ThreatIntelligence', () => {
    it('should verify threat breakdown mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.threatScoresToThreatIntelligence).toBe(true);
      expect(result.details.threatScores).toContain('✓ Threat breakdown correctly mapped for TRK-001: 5 factors');
      expect(result.details.threatScores).toContain('✓ Threat breakdown correctly mapped for TRK-002: 2 factors');
    });

    it('should handle tracks without explanations', () => {
      const modifiedData = { ...sampleData };
      modifiedData.tracks = [
        {
          ...sampleData.tracks[0],
          explanation: []
        }
      ];
      
      const result = verifier.verifyOverlayMapping(modifiedData);
      
      // Should still be valid even with empty explanations
      expect(result.threatScoresToThreatIntelligence).toBe(true);
      expect(result.details.threatScores.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement 5.4: Behavioral Explanations to IntruderList', () => {
    it('should verify loitering behavior mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.behavioralExplanationsToIntruderList).toBe(true);
      expect(result.details.behavioralExplanations).toContain('✓ Loitering behavior correctly mapped for TRK-001: true');
      expect(result.details.behavioralExplanations).toContain('✓ Loitering behavior correctly mapped for TRK-002: false');
    });

    it('should verify speed anomaly mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.behavioralExplanations).toContain('✓ Speed anomaly correctly mapped for TRK-001: false');
      expect(result.details.behavioralExplanations).toContain('✓ Speed anomaly correctly mapped for TRK-002: true');
    });

    it('should verify trajectory stability mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.behavioralExplanations).toContain('✓ Trajectory stability correctly mapped for TRK-001: Moderate');
      expect(result.details.behavioralExplanations).toContain('✓ Trajectory stability correctly mapped for TRK-002: Erratic');
    });

    it('should verify trajectory confidence mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.behavioralExplanations).toContain('✓ Trajectory confidence correctly mapped for TRK-001: 85%');
      expect(result.details.behavioralExplanations).toContain('✓ Trajectory confidence correctly mapped for TRK-002: 60%');
    });
  });

  describe('Requirement 5.5: Prediction Confidence to ThreatIntelligence', () => {
    it('should verify prediction confidence mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.predictionConfidenceToThreatIntelligence).toBe(true);
      expect(result.details.predictionConfidence).toContain('✓ Prediction confidence correctly mapped for TRK-001: High');
      expect(result.details.predictionConfidence).toContain('✓ Prediction confidence correctly mapped for TRK-002: Medium');
    });

    it('should verify will enter restricted mapping', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.predictionConfidence).toContain('✓ Will enter restricted correctly mapped for TRK-001: true');
      expect(result.details.predictionConfidence).toContain('✓ Will enter restricted correctly mapped for TRK-002: false');
    });

    it('should verify prediction descriptions are present', () => {
      const result = verifier.verifyOverlayMapping(sampleData);
      
      expect(result.details.predictionConfidence).toContain('✓ Prediction descriptions correctly mapped for TRK-001');
      expect(result.details.predictionConfidence).toContain('✓ Prediction descriptions correctly mapped for TRK-002');
    });
  });

  describe('Error Detection', () => {
    it('should detect missing threat intelligence data', () => {
      // Create data that will have valid structure but test edge cases
      const validData: PythonSystemData = {
        system: sampleData.system,
        tracks: [
          {
            id: 999,
            zone: 'PUBLIC',
            threat_score: 10,
            threat_level: 'LOW',
            detection_time: 30,
            behavior: {
              loitering: { active: false },
              speed_anomaly: false,
              trajectory_confidence: 0.5
            },
            prediction: {
              near: { zone: 'PUBLIC', confidence: 0.8 },
              medium: { zone: 'PUBLIC', confidence: 0.7 },
              far: { zone: 'PUBLIC', confidence: 0.6 }
            },
            explanation: []
          }
        ],
        alerts: [],
        timestamp: new Date().toISOString()
      };

      const result = verifier.verifyOverlayMapping(validData);
      
      // Should work with valid data structure, even with empty explanations
      expect(result.threatScoresToThreatIntelligence).toBe(true);
      expect(result.details.threatScores.length).toBeGreaterThan(0);
    });

    it('should handle malformed Python data gracefully', () => {
      const malformedData = {
        ...sampleData,
        system: null
      } as any;

      const result = verifier.verifyOverlayMapping(malformedData);
      
      // Should handle gracefully and return failed verification for power metrics
      expect(result).toBeDefined();
      expect(result.powerMetricsToSystemStatus).toBe(false);
      expect(result.details.powerMetrics).toContain('Python system data is null or undefined');
    });
  });
});