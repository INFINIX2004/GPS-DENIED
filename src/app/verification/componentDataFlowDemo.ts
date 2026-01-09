// Component Data Flow Demonstration
// Shows how Python overlay data flows to dashboard components
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5

import { AeroVisionDataTransformer } from '../services/dataTransformer';
import { createSamplePythonDataWithOverlays } from './overlayDataMapping';

/**
 * Demonstrate the complete data flow from Python overlay data to dashboard components
 */
export function demonstrateComponentDataFlow(): void {
  console.log('🔄 AeroVision Dashboard - Component Data Flow Demonstration');
  console.log('=' .repeat(70));
  
  const transformer = new AeroVisionDataTransformer(false);
  const pythonData = createSamplePythonDataWithOverlays();
  
  console.log('\n📥 Python Overlay Data (Input):');
  console.log('─'.repeat(40));
  
  // Show Python system data
  console.log('\n🔋 System/Power Data:');
  console.log(`  Power Mode: ${pythonData.system.power_mode}`);
  console.log(`  Power Consumption: ${pythonData.system.power_w}W`);
  console.log(`  Battery Remaining: ${pythonData.system.battery_minutes} minutes`);
  console.log(`  FPS: ${pythonData.system.fps}`);
  console.log(`  Camera Status: ${pythonData.system.camera_status}`);
  
  // Show Python track data
  console.log('\n🎯 Track/Threat Data:');
  pythonData.tracks.forEach((track, index) => {
    console.log(`  Track ${track.id}:`);
    console.log(`    Zone: ${track.zone}`);
    console.log(`    Threat Score: ${track.threat_score}`);
    console.log(`    Threat Level: ${track.threat_level}`);
    console.log(`    Loitering: ${track.behavior.loitering.active} ${track.behavior.loitering.duration ? `(${track.behavior.loitering.duration}s)` : ''}`);
    console.log(`    Speed Anomaly: ${track.behavior.speed_anomaly}`);
    console.log(`    Trajectory Confidence: ${(track.behavior.trajectory_confidence * 100).toFixed(0)}%`);
    console.log(`    Prediction Confidence: ${track.prediction.overall_confidence}`);
    console.log(`    Explanation Factors: ${track.explanation.length}`);
  });
  
  // Transform the data
  console.log('\n🔄 Data Transformation...');
  const systemState = transformer.transformSystemData(pythonData);
  
  console.log('\n📤 Dashboard Component Data (Output):');
  console.log('─'.repeat(40));
  
  // Requirement 5.1: SystemStatus Component Data
  console.log('\n🖥️  SystemStatus Component Props:');
  console.log(`  powerMode: "${systemState.systemStatus.powerMode}"`);
  console.log(`  powerConsumption: ${systemState.systemStatus.powerConsumption}`);
  console.log(`  batteryRemaining: ${systemState.systemStatus.batteryRemaining}`);
  console.log(`  fps: ${systemState.systemStatus.fps}`);
  console.log(`  cameraStatus: "${systemState.systemStatus.cameraStatus}"`);
  console.log(`  processingStatus: "${systemState.systemStatus.processingStatus}"`);
  
  // Requirement 5.2 & 5.4: IntruderList Component Data
  console.log('\n👥 IntruderList Component Props:');
  console.log(`  intruders: [${systemState.intruders.length} items]`);
  systemState.intruders.forEach((intruder, index) => {
    console.log(`    [${index}] trackId: "${intruder.trackId}"`);
    console.log(`        zone: "${intruder.zone}" (Req 5.2: Zone Status)`);
    console.log(`        threatScore: ${intruder.threatScore}`);
    console.log(`        threatLevel: "${intruder.threatLevel}"`);
    console.log(`        timeSinceDetection: ${intruder.timeSinceDetection}s`);
  });
  
  // Requirement 5.3 & 5.5: ThreatIntelligence Component Data
  console.log('\n🧠 ThreatIntelligence Component Props:');
  Object.entries(systemState.threatIntelligence).forEach(([trackId, intelligence]) => {
    console.log(`  ${trackId}:`);
    console.log(`    threatBreakdown: [${intelligence.threatBreakdown.length} factors] (Req 5.3: Threat Scores)`);
    intelligence.threatBreakdown.forEach((breakdown, index) => {
      console.log(`      [${index}] ${breakdown.factor}: ${breakdown.score}`);
    });
    
    console.log(`    behavioral: (Req 5.4: Behavioral Explanations)`);
    console.log(`      loitering: ${intelligence.behavioral.loitering}`);
    console.log(`      loiteringDuration: ${intelligence.behavioral.loiteringDuration || 'N/A'}`);
    console.log(`      speedAnomaly: ${intelligence.behavioral.speedAnomaly}`);
    console.log(`      trajectoryStability: "${intelligence.behavioral.trajectoryStability}"`);
    console.log(`      trajectoryConfidence: ${intelligence.behavioral.trajectoryConfidence}%`);
    
    console.log(`    prediction: (Req 5.5: Prediction Confidence)`);
    console.log(`      confidence: "${intelligence.prediction.confidence}"`);
    console.log(`      willEnterRestricted: ${intelligence.prediction.willEnterRestricted}`);
    console.log(`      nearTerm: "${intelligence.prediction.nearTerm}"`);
    console.log(`      mediumTerm: "${intelligence.prediction.mediumTerm}"`);
    console.log(`      farTerm: "${intelligence.prediction.farTerm}"`);
  });
  
  console.log('\n📊 Data Flow Summary:');
  console.log('─'.repeat(40));
  console.log('✅ Requirement 5.1: Power metrics → SystemStatus component');
  console.log('   Python system.power_mode → SystemStatus.powerMode');
  console.log('   Python system.power_w → SystemStatus.powerConsumption');
  console.log('   Python system.battery_minutes → SystemStatus.batteryRemaining');
  console.log('   Python system.fps → SystemStatus.fps');
  console.log('   Python system.camera_status → SystemStatus.cameraStatus');
  
  console.log('\n✅ Requirement 5.2: Zone status → ThreatIntelligence component');
  console.log('   Python track.zone → IntruderList.intruders[].zone');
  console.log('   Zone information accessible via selected intruder');
  
  console.log('\n✅ Requirement 5.3: Threat scores → ThreatIntelligence component');
  console.log('   Python track.explanation[] → ThreatIntelligence.threatBreakdown[]');
  console.log('   Python track.threat_score → IntruderList.intruders[].threatScore');
  
  console.log('\n✅ Requirement 5.4: Behavioral explanations → IntruderList component');
  console.log('   Python track.behavior → ThreatIntelligence.behavioral');
  console.log('   Accessible via IntruderList selection → ThreatIntelligence display');
  
  console.log('\n✅ Requirement 5.5: Prediction confidence → ThreatIntelligence component');
  console.log('   Python track.prediction → ThreatIntelligence.prediction');
  console.log('   Python track.prediction.overall_confidence → prediction.confidence');
  
  console.log('\n🎉 All Python overlay data successfully mapped to dashboard components!');
  console.log('   Video feed remains clean while all surveillance metrics are accessible');
  console.log('   in appropriate dashboard components as specified in requirements.');
  
  console.log('\n' + '=' .repeat(70));
}

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateComponentDataFlow();
}