// Debug overlay mapping verification
import { OverlayDataMappingVerifier, createSamplePythonDataWithOverlays } from './app/verification/overlayDataMapping';

const verifier = new OverlayDataMappingVerifier();
const sampleData = createSamplePythonDataWithOverlays();

// Test with empty explanations
const modifiedData = { ...sampleData };
modifiedData.tracks = [
  {
    ...sampleData.tracks[0],
    explanation: []
  }
];

const result = verifier.verifyOverlayMapping(modifiedData);

console.log('Threat scores details:', result.details.threatScores);
console.log('All mappings valid:', result.allMappingsValid);
console.log('Threat scores mapping:', result.threatScoresToThreatIntelligence);

// Test with valid data with empty explanations
const validData = {
  system: sampleData.system,
  tracks: [
    {
      id: 999,
      zone: 'PUBLIC' as const,
      threat_score: 10,
      threat_level: 'LOW' as const,
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

const result2 = verifier.verifyOverlayMapping(validData);
console.log('\nValid data threat scores details:', result2.details.threatScores);
console.log('Valid data all mappings valid:', result2.allMappingsValid);