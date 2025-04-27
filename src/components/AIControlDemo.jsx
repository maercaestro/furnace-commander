import { useState, useEffect, useRef } from 'react';
import * as ort from 'onnxruntime-web';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import { Link } from 'react-router-dom';
Chart.register(...registerables);

const AIControlDemo = () => {
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  
  // Furnace state
  const [currentTemp, setCurrentTemp] = useState(400); // Start at 400°C
  const [excessO2, setExcessO2] = useState(2.0);
  const [fuelFlow, setFuelFlow] = useState(10);
  const [airFuelRatio, setAirFuelRatio] = useState(14.7);
  const [targetTemp, setTargetTemp] = useState(450);
  
  // Add these two state variables
  const [inflowTemp, setInflowTemp] = useState(150); // Start at middle of range 100-200
  const [inflowRate, setInflowRate] = useState(75); // Start at middle of range 50-150
  
  // Score tracking (similar to main game)
  const [costSavings, setCostSavings] = useState(0);
  const [cumulativeCO, setCumulativeCO] = useState(0);
  const [cumulativeCO2, setCumulativeCO2] = useState(0);
  const [score, setScore] = useState(0);
  const [grade, setGrade] = useState('');
  
  // Define optimal ranges
  const optimalO2Min = 1.5;
  const optimalO2Max = 2.5;
  
  // History for charts
  const [tempHistory, setTempHistory] = useState([400]);
  const [o2History, setO2History] = useState([2.0]);
  const [controlHistory, setControlHistory] = useState([]);
  const [costSavingsHistory, setCostSavingsHistory] = useState([0]);
  // Add these state variables for history tracking
  const [inflowTempHistory, setInflowTempHistory] = useState([150]);
  const [inflowRateHistory, setInflowRateHistory] = useState([75]);
  
  // Constants from your training script
  const inputMeans = [10.5, 12.8, 262.5, 150.0, 125.0];
  const inputStds = [5.5, 7.05, 137.0, 29.0, 43.0];
  const outputMeans = [263.0, 2.0];
  const outputStds = [137.0, 0.8];
  
  // Load the ONNX model
  useEffect(() => {
    async function loadModel() {
      try {
        setLoading(true);
        const session = await ort.InferenceSession.create('/models/lnn_model.onnx');
        setModel(session);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load ONNX model:", err);
        setError(`Failed to load AI model: ${err.message}`);
        setLoading(false);
      }
    }
    
    loadModel();
  }, []);
  
  // Reset simulation when starting
  useEffect(() => {
    if (running) {
      setCurrentTemp(400);
      setCostSavings(0);
      setCumulativeCO(0);
      setCumulativeCO2(0);
      setSimulationTime(0);
      setTempHistory([400]);
      setO2History([2.0]);
      setCostSavingsHistory([0]);
      setControlHistory([]);
      setInflowTemp(150); // Reset to middle value
      setInflowRate(75);  // Reset to middle value
      setInflowTempHistory([150]);
      setInflowRateHistory([75]);
      setCompleted(false);
    }
  }, [running]);
  
  // Calculate costs and emissions (similar to main game)
  const calculateCostAndEmissions = (o2Level, fuel) => {
    // Cost calculation
    let costChange = 0;
    if (o2Level >= optimalO2Min && o2Level <= optimalO2Max) {
      costChange = 0.05; // Savings when O2 is optimal
    } else if (o2Level < optimalO2Min) {
      costChange = -0.1; // Penalty for too little O2
    } else if (o2Level > optimalO2Max) {
      costChange = -0.05 * (o2Level - optimalO2Max); // Penalty for excess O2
    }
    
    // CO emissions calculation - increase sensitivity to low O2
    let coEmission = 0;
    if (o2Level < 1.0) {
      // Exponential growth of CO at very low O2 levels
      coEmission = 3.0 * Math.exp(2.0 * (1.0 - o2Level));
    } else if (o2Level < optimalO2Min) {
      // Linear increase in low but not critical O2 region
      coEmission = 0.5 * (optimalO2Min - o2Level);
    }
    
    // Factor in fuel flow - higher fuel flow with low O2 creates more CO
    coEmission *= (fuel / 10.0);
    
    // CO2 is roughly proportional to fuel use
    const co2Emission = 0.1 * fuel;
    
    return { costChange, coEmission, co2Emission };
  };
  
  // Calculate grade based on performance
  const calculateGrade = (temp, o2, cost, co) => {
    let gradePoints = 0;
    
    // Temperature accuracy (up to 50 points)
    const tempDiff = Math.abs(temp - targetTemp);
    if (tempDiff < 5) gradePoints += 50;
    else if (tempDiff < 15) gradePoints += 40;
    else if (tempDiff < 25) gradePoints += 30;
    else if (tempDiff < 40) gradePoints += 20;
    else gradePoints += 10;
    
    // O2 control (up to 25 points)
    if (o2 >= optimalO2Min && o2 <= optimalO2Max) gradePoints += 25;
    else if (o2 > 1.0 && o2 < 3.0) gradePoints += 15;
    else if (o2 > 0.5 && o2 < 4.0) gradePoints += 5;
    
    // Cost savings (up to 15 points)
    if (cost > 5) gradePoints += 15;
    else if (cost > 2) gradePoints += 10;
    else if (cost > 0) gradePoints += 5;
    
    // CO emissions (up to 10 points)
    if (co < 10) gradePoints += 10;
    else if (co < 30) gradePoints += 5;
    
    // Determine letter grade
    let letterGrade;
    if (gradePoints >= 90) letterGrade = 'A';
    else if (gradePoints >= 80) letterGrade = 'B';
    else if (gradePoints >= 70) letterGrade = 'C';
    else if (gradePoints >= 60) letterGrade = 'D';
    else letterGrade = 'F';
    
    return { points: gradePoints, grade: letterGrade };
  };
  
  // Main simulation loop
  useEffect(() => {
    if (!running || !model || completed) return;
    
    const interval = setInterval(async () => {
      // Increment simulation time
      const newTime = simulationTime + 1;
      setSimulationTime(newTime);
      
      // Create input sequence
      const sequence = createInputSequence();
      
      // Run prediction
      const prediction = await runInference(sequence);
      
      // Update furnace state based on prediction
      const [predictedTemp, predictedO2] = prediction;
      
      // Apply prediction with some noise and dynamics
      // Adjust temperature to gradually approach target from 400°C
      const tempRampFactor = Math.min(1, newTime / 30); // Ramp up over 30 seconds
      const targetTempDifference = targetTemp - 400;
      const rampedTarget = 400 + (targetTempDifference * tempRampFactor);
      
      // Calculate inflow impact - higher inflow temp and rate increase furnace temperature
      const inflowImpact = 0.02 * ((inflowTemp - 150) / 50) + 0.01 * ((inflowRate - 75) / 25);
      
      // Calculate new temperature with tendency to move toward ramped target plus inflow impact
      const tempError = rampedTarget - currentTemp;
      const newTemp = currentTemp + (tempError * 0.05) + inflowImpact + (Math.random() - 0.5) * 2;
      
      // Calculate new O2 with prediction and noise
      // Make O2 more responsive to fuel changes - high fuel flow tends to reduce O2 levels
      const fuelImpactOnO2 = 0.1 * Math.max(0, (fuelFlow - 10) / 10); // Higher fuel can deplete O2
      const newO2 = Math.max(0.1, excessO2 * 0.8 + predictedO2 * 0.2 - fuelImpactOnO2 + (Math.random() - 0.5) * 0.1);
      
      const newInflowTemp = inflowTemp + (Math.random() - 0.5) * 10; // Change by up to ±5°C per second
      const boundedInflowTemp = Math.max(100, Math.min(200, newInflowTemp)); // Keep within 100-200°C

      const newInflowRate = inflowRate + (Math.random() - 0.5) * 10; // Change by up to ±5 units per second  
      const boundedInflowRate = Math.max(50, Math.min(150, newInflowRate)); // Keep within 50-150 units/h


      // Calculate optimal control actions
      const optimalFuelFlow = calculateOptimalFuel(newTemp, rampedTarget);
      const optimalAFR = calculateOptimalAFR(newO2);
      
      // Calculate cost and emissions
      const { costChange, coEmission, co2Emission } = calculateCostAndEmissions(newO2, optimalFuelFlow);
      const newCostSavings = costSavings + costChange;
      const newCumulativeCO = cumulativeCO + coEmission;
      const newCumulativeCO2 = cumulativeCO2 + co2Emission;
      
      // Update state
      setCurrentTemp(newTemp);
      setExcessO2(newO2);
      setFuelFlow(optimalFuelFlow);
      setAirFuelRatio(optimalAFR);
      setCostSavings(newCostSavings);
      setCumulativeCO(newCumulativeCO);
      setCumulativeCO2(newCumulativeCO2);
      setInflowTemp(boundedInflowTemp);
      setInflowRate(boundedInflowRate);
      
      // Update history
      setTempHistory(prev => [...prev, newTemp].slice(-50));
      setO2History(prev => [...prev, newO2].slice(-50));
      setCostSavingsHistory(prev => [...prev, newCostSavings].slice(-50));
      setControlHistory(prev => [...prev, { fuelFlow: optimalFuelFlow, afr: optimalAFR }].slice(-50));
      // Track inflow temperature
      setInflowTempHistory(prev => [...prev, boundedInflowTemp].slice(-50));
      // Track inflow rate
      setInflowRateHistory(prev => [...prev, boundedInflowRate].slice(-50));
      
      // Check if simulation should complete (after 60 seconds or when temp is stable near target)
      if (newTime > 60 || (Math.abs(newTemp - targetTemp) < 5 && newTime > 30)) {
        // Calculate score and grade
        const { points, grade } = calculateGrade(newTemp, newO2, newCostSavings, newCumulativeCO);
        setScore(points);
        setGrade(grade);
        setCompleted(true);
        setRunning(false);
      }
      
    }, 1000);
    
    return () => clearInterval(interval);
  }, [running, model, currentTemp, excessO2, fuelFlow, airFuelRatio, targetTemp, simulationTime, completed, costSavings, cumulativeCO, cumulativeCO2]);
  
  // Helper functions
  const createInputSequence = () => {
    const sequence = Array(30).fill([
      (fuelFlow - inputMeans[0]) / inputStds[0],
      (airFuelRatio - inputMeans[1]) / inputStds[1],
      (currentTemp - inputMeans[2]) / inputStds[2],
      (inflowTemp - inputMeans[3]) / inputStds[3], // Use actual inflow temp
      (inflowRate - inputMeans[4]) / inputStds[4]  // Use actual inflow rate
    ]);
    return sequence;
  };
  
  const runInference = async (inputSequence) => {
    if (!model) return [currentTemp, excessO2];
    
    try {
      // Create tensor from sequence
      const tensorData = new Float32Array(inputSequence.flat());
      const tensor = new ort.Tensor('float32', tensorData, [1, 30, 5]);
      
      // Run inference
      const results = await model.run({ input: tensor });
      const outputData = results.output.data;
      
      // Get the last prediction
      const lastPrediction = [
        outputData[outputData.length - 2],
        outputData[outputData.length - 1]
      ];
      
      // Denormalize predictions and apply offset to O2
      const denormalized = [
        lastPrediction[0] * outputStds[0] + outputMeans[0],
        (lastPrediction[1] * outputStds[1] + outputMeans[1]) - 0.2  // Apply -0.2% offset to O2
      ];
      
      return denormalized;
    } catch (error) {
      console.error("Inference error:", error);
      return [currentTemp, excessO2];
    }
  };
  
  const calculateOptimalFuel = (temp, target) => {
    const error = target - temp;
    return Math.max(5, Math.min(20, fuelFlow + error * 0.05));
  };
  
  const calculateOptimalAFR = (o2) => {
    if (o2 < 1.5) return Math.min(25, airFuelRatio + 0.2);
    if (o2 > 2.5) return Math.max(10, airFuelRatio - 0.2);
    return airFuelRatio;
  };

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full bg-[#f4e3c3] p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">AI Furnace Control</h1>
        <Link 
          to="/"
          className="bg-gray-50 text-gray-700 px-4 py-2 rounded hover:bg-gray-700 flex items-center"
        >
          <span className="mr-1">←</span> Back to Game
        </Link>
      </div>
      
      {/* Performance Metrics */}
      {running || completed ? (
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Target Status</div>
              <div className="flex items-center">
                <div className={`text-lg font-bold ${Math.abs(currentTemp - targetTemp) < 10 ? 'text-green-600' : 'text-orange-600'}`}>
                  {Math.abs(currentTemp - targetTemp) < 10 ? 'On Target' : `${Math.abs(currentTemp - targetTemp).toFixed(1)}°C off`}
                </div>
                <div className="text-sm text-gray-500 ml-2">({targetTemp}°C)</div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Cost Impact</div>
              <div className={`text-lg font-bold ${costSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {costSavings > 0 ? '+' : ''}{costSavings.toFixed(2)} $
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">CO Emissions</div>
              <div className={`text-lg font-bold ${cumulativeCO < 30 ? 'text-green-600' : 'text-red-600'}`}>
                {cumulativeCO.toFixed(1)} kg
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">Simulation Time</div>
              <div className="text-lg font-bold text-gray-800">
                {formatTime(simulationTime)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">AI Control Demonstration</h2>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3">Loading AI model...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            <p>{error}</p>
            <p className="mt-2 text-sm">Please make sure the ONNX model is correctly placed in the public/models folder.</p>
          </div>
        ) : completed ? (
          <>
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">
                  {Math.abs(currentTemp - targetTemp) < 10 
                    ? '✅ Target Temperature Reached!' 
                    : '❌ Failed to Reach Target Temperature'}
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-sm font-medium text-gray-500">Overall Score</div>
                  <div className="text-4xl font-bold text-blue-600">{score}</div>
                  <div className={`text-4xl font-bold ${
                    grade === 'A' ? 'text-green-600' :
                    grade === 'B' ? 'text-green-500' :
                    grade === 'C' ? 'text-yellow-500' :
                    grade === 'D' ? 'text-orange-500' :
                    'text-red-600'
                  }`}>
                    {grade}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Temperature Performance:</div>
                  <div className="text-gray-600">
                    Final temperature: {currentTemp.toFixed(1)}°C (Target: {targetTemp}°C)
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">O₂ Control:</div>
                  <div className={`${excessO2 >= optimalO2Min && excessO2 <= optimalO2Max ? 'text-green-600' : 'text-red-600'}`}>
                    Final O₂: {excessO2.toFixed(2)}% (Optimal: {optimalO2Min}-{optimalO2Max}%)
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Economic Impact:</div>
                  <div className={`${costSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Cost savings: {costSavings.toFixed(2)} $
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Environmental Impact:</div>
                  <div className={`${cumulativeCO < 30 ? 'text-green-600' : 'text-red-600'}`}>
                    CO emissions: {cumulativeCO.toFixed(1)} kg
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  onClick={() => {
                    setRunning(true);
                    setCompleted(false);
                  }}
                >
                  Try Again
                </button>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-2">Performance History</h3>
              <div className="h-64 bg-white p-2 border rounded">
                {tempHistory.length > 1 && (
                  <Line 
                    data={{
                      labels: Array(tempHistory.length).fill(''),
                      datasets: [
                        {
                          label: 'Temperature',
                          data: tempHistory,
                          borderColor: 'rgb(255, 99, 132)',
                          tension: 0.1,
                          yAxisID: 'y'
                        },
                        {
                          label: 'Excess O₂',
                          data: o2History,
                          borderColor: 'rgb(54, 162, 235)',
                          tension: 0.1,
                          yAxisID: 'y1'
                        },
                        // Add inlet condition tracking
                        {
                          label: 'Inflow Temp (scaled)',
                          data: tempHistory.map((_, i) => i < inflowTempHistory.length ? 
                            380 + ((inflowTempHistory[i] - 100) / 100) * 40 : null),
                          borderColor: 'rgba(75, 192, 192, 0.5)',
                          borderDash: [5, 5],
                          tension: 0.1,
                          yAxisID: 'y'
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          type: 'linear',
                          display: true,
                          position: 'left',
                          title: {
                            display: true,
                            text: 'Temperature (°C)'
                          },
                          min: 380,
                          max: 500
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          title: {
                            display: true,
                            text: 'Excess O₂ (%)'
                          },
                          min: 0,
                          max: 5,
                          grid: {
                            drawOnChartArea: false
                          }
                        }
                      },
                      animation: {
                        duration: 0
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <button
                  className={`px-4 py-2 rounded ${running ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-gray-700`}
                  onClick={() => setRunning(!running)}
                >
                  {running ? 'Stop Simulation' : 'Start AI Control'}
                </button>
              </div>
              
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-sm text-gray-600">Target Temperature</label>
                  <input 
                    type="range" 
                    min="420" 
                    max="480" 
                    step="5"
                    value={targetTemp} 
                    onChange={(e) => setTargetTemp(Number(e.target.value))}
                    className="w-32" 
                  />
                  <span className="ml-2">{targetTemp}°C</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-2">Process Values</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Current Temperature</div>
                    <div className="text-xl font-bold">{Math.round(currentTemp)}°C</div>
                    <div className="text-sm text-gray-500">Starting at 400°C</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Excess O₂</div>
                    <div className={`text-xl font-bold ${excessO2 >= 1.5 && excessO2 <= 2.5 ? 'text-green-600' : 'text-red-600'}`}>
                      {excessO2.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-500">Optimal: 1.5-2.5%</div>
                  </div>
                  {/* Add these new display values */}
                  <div>
                    <div className="text-sm text-gray-500">Inflow Temperature</div>
                    <div className="text-xl font-bold">{Math.round(inflowTemp)}°C</div>
                    <div className="text-sm text-gray-500">Varies: 100-200°C</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Inflow Rate</div>
                    <div className="text-xl font-bold">{Math.round(inflowRate)} units/h</div>
                    <div className="text-sm text-gray-500">Varies: 50-150 units/h</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-2">AI Controller Status</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Model:</span>
                    <span className="font-medium">LiquidNN</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-medium text-green-600">Ready</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Control Goal:</span>
                    <span className="font-medium">Optimal O₂ (1.5-2.5%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Challenge:</span>
                    <span className="font-medium">400°C → {targetTemp}°C</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-2">Instructions</h3>
              <div className="p-4 bg-blue-50 rounded-lg text-gray-700">
                <p className="mb-2">
                  This simulation demonstrates how the AI controller can bring the furnace from 
                  400°C to the target temperature while maintaining optimal O₂ levels.
                </p>
                <p className="mb-2">
                  <strong>Challenge:</strong> The inlet temperature (100-200°C) and flow rate (50-150 units/h)
                  vary randomly, making temperature control more difficult. The AI must adapt
                  to these changing conditions.
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Click "Start AI Control" to begin the simulation</li>
                  <li>Watch as the AI controller adjusts fuel and air to reach {targetTemp}°C</li>
                  <li>The simulation runs for up to 60 seconds or until temperature stabilizes</li>
                  <li>Your final score will be based on temperature accuracy, O₂ control, cost savings, and emissions</li>
                </ol>
              </div>
            </div>
          </>
        )}
        
        <div className="mt-6">
          <h3 className="font-bold text-lg mb-2">How It Works</h3>
          <p className="text-gray-700">
            This demonstration shows how your trained LiquidNN neural network model can be used
            to predict and control furnace behavior. The AI controller:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
            <li>Predicts future temperature and excess O₂ based on current conditions</li>
            <li>Adjusts fuel flow and air/fuel ratio to maintain optimal combustion</li>
            <li>Balances reaching target temperature while keeping excess O₂ in the 1.5-2.5% range</li>
            <li>Demonstrates how a machine learning model can replace traditional PID controllers</li>
          </ul>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <Link 
          to="/"
          className="bg-gray-50 text-gray-700 px-6 py-2 rounded hover:bg-gray-700 inline-block"
        >
          Return to Main Game
        </Link>
      </div>
    </div>
  );
};

export default AIControlDemo;