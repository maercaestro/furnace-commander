// Constants from your training script
export const MODEL_CONFIG = {
  inputMeans: [10.5, 12.8, 262.5, 150.0, 125.0],
  inputStds: [5.5, 7.05, 137.0, 29.0, 43.0],
  outputMeans: [263.0, 2.0],
  outputStds: [137.0, 0.8],
  sequenceLength: 30,
  inputFeatures: 5,
  outputFeatures: 2
};

// Normalize input based on training stats
export function normalizeInput(rawInput, means = MODEL_CONFIG.inputMeans, stds = MODEL_CONFIG.inputStds) {
  return rawInput.map((value, i) => (value - means[i]) / stds[i]);
}

// Denormalize output
export function denormalizeOutput(normalizedOutput, means = MODEL_CONFIG.outputMeans, stds = MODEL_CONFIG.outputStds) {
  return normalizedOutput.map((value, i) => value * stds[i] + means[i]);
}

// Create a sequence with proper padding if needed
export function createSequence(currentState, history = [], seqLength = MODEL_CONFIG.sequenceLength) {
  const combined = [...history, currentState];
  if (combined.length >= seqLength) {
    return combined.slice(-seqLength);
  }
  
  // Pad with copies of the first state
  const padding = Array(seqLength - combined.length).fill(combined[0] || currentState);
  return [...padding, ...combined];
}