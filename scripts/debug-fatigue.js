// Debug script to compare calculated values with PDF expected values
// Run with: node scripts/debug-fatigue.js

const {
  calculateFatigueSequence,
  calculateFatigueIndexSequence,
} = require('../src/lib/fatigue');

const roster01Params = {
  commuteTime: 120,
  workload: 2,
  attention: 2,
  breakFrequency: 180,
  breakLength: 15,
  continuousWork: 240,
  breakAfterContinuous: 30
};

const roster01Shifts = [
  { day: 1, startTime: '06:00', endTime: '18:00' },
  { day: 2, startTime: '06:00', endTime: '18:00' },
  { day: 3, startTime: '06:00', endTime: '18:00' },
  { day: 4, startTime: '06:00', endTime: '18:00' },
  { day: 5, startTime: '06:00', endTime: '18:00' },
  { day: 8, startTime: '06:00', endTime: '18:00' },
  { day: 9, startTime: '06:00', endTime: '18:00' },
  { day: 10, startTime: '06:00', endTime: '18:00' },
  { day: 11, startTime: '06:00', endTime: '18:00' },
  { day: 12, startTime: '06:00', endTime: '18:00' },
];

const expectedRisk = [0.99, 1.04, 1.09, 1.14, 1.20, 1.02, 1.07, 1.12, 1.17, 1.22];
const expectedFatigue = [5.7, 7.9, 11.5, 15.1, 18.0, 7.3, 10.8, 14.4, 17.5, 19.8];

console.log('=== ROSTER 01 COMPARISON ===\n');

const riskResults = calculateFatigueSequence(roster01Shifts, roster01Params);
const fatigueResults = calculateFatigueIndexSequence(roster01Shifts, roster01Params);

console.log('RISK INDEX:');
console.log('Day | Expected | Calculated | Diff   | Cum    | Timing | JobBrk');
console.log('-'.repeat(70));

riskResults.forEach((r, i) => {
  const diff = (r.riskIndex - expectedRisk[i]).toFixed(3);
  console.log(
    `${r.day.toString().padStart(3)} | ` +
    `${expectedRisk[i].toFixed(2).padStart(8)} | ` +
    `${r.riskIndex.toFixed(3).padStart(10)} | ` +
    `${diff.padStart(6)} | ` +
    `${r.cumulative.toFixed(3).padStart(6)} | ` +
    `${r.timing.toFixed(3).padStart(6)} | ` +
    `${r.jobBreaks.toFixed(3).padStart(6)}`
  );
});

console.log('\nFATIGUE INDEX:');
console.log('Day | Expected | Calculated | Diff   | Cum    | ToD    | Task');
console.log('-'.repeat(70));

fatigueResults.forEach((r, i) => {
  const diff = (r.fatigueIndex - expectedFatigue[i]).toFixed(1);
  console.log(
    `${r.day.toString().padStart(3)} | ` +
    `${expectedFatigue[i].toFixed(1).padStart(8)} | ` +
    `${r.fatigueIndex.toFixed(1).padStart(10)} | ` +
    `${diff.padStart(6)} | ` +
    `${r.cumulative.toFixed(1).padStart(6)} | ` +
    `${r.timeOfDay.toFixed(1).padStart(6)} | ` +
    `${r.task.toFixed(1).padStart(6)}`
  );
});
