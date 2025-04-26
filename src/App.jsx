import { useState, useEffect, useCallback } from 'react'
import logoFC from './assets/logo_fc.png'
import furnaceImg from './assets/furnace.png'
import './App.css'

// Heat transfer based temperature calculation
function calculateTemperature(fuelFlow, airFlow, currentTemp, inflowTemp, inflowRate) {
  // Convert rates to SI per second (if they are in units/hour)
  const fuel_s = fuelFlow / 3600; // Convert from units/hour to units/second
  const inflow_s = inflowRate / 3600; // Convert from units/hour to units/second
  
  // Constants for the heat transfer model (adjusted for better balance)
  const AFR_opt = 14.7;                 // Optimal air/fuel ratio
  const maxFuelEnergy = 39000;          // Energy released per unit of fuel (kJ per Nm³ of gas)
  const furnaceMass = 5000;             // Thermal mass of the furnace (kg)
  const specificHeat = 0.5;             // Specific heat capacity (kJ/kg·°C)
  const heatLossCoeff = 0.0005;         // Heat loss coefficient to environment (kJ/°C·s)
  const inletHeatTransferCoeff = 0.0002; // Heat transfer coefficient for incoming material (kJ/(unit·°C·s))
  const ambientTemp = 25;               // Ambient temperature (°C)
  const timeStep = 1;                   // Simulation time step (seconds)
  
  // Calculate combustion efficiency based on air/fuel ratio
  // Uses a Gaussian curve peaking at the optimal ratio
  const AFR = airFlow / Math.max(0.1, fuelFlow); // Avoid division by zero
  const sigma = 2; // Width of the efficiency curve
  const efficiency = Math.exp(-Math.pow(AFR - AFR_opt, 2) / (2 * Math.pow(sigma, 2)));
  
  // Energy input from combustion (kJ)
  const Q_comb = fuel_s * maxFuelEnergy * efficiency * timeStep;
  
  // Heat loss to environment (kJ)
  const Q_env_loss = heatLossCoeff * (currentTemp - ambientTemp) * timeStep;
  
  // Heat transfer to incoming material (kJ)
  const Q_inflow = inletHeatTransferCoeff * inflow_s * (currentTemp - inflowTemp) * timeStep;
  
  // Net energy change (kJ)
  const netEnergy = Q_comb - Q_env_loss - Q_inflow;
  
  // Temperature change (°C) based on furnace thermal mass
  const tempChange = netEnergy / (furnaceMass * specificHeat);
  
  // Calculate new temperature with reduced random noise
  const noise = (Math.random() - 0.5) * 2; // ±1°C fluctuation (reduced from ±2.5°C)
  const newTemp = currentTemp + tempChange + noise;
  
  // Log heat terms for debugging if needed
  // console.log(`Q_comb: ${Q_comb.toFixed(2)} kJ, Q_env_loss: ${Q_env_loss.toFixed(2)} kJ, Q_inflow: ${Q_inflow.toFixed(2)} kJ, netEnergy: ${netEnergy.toFixed(2)} kJ, tempChange: ${tempChange.toFixed(2)}°C`);
  
  return Math.max(ambientTemp, parseFloat(newTemp.toFixed(1))); // Temperature can't go below ambient
}

function App() {
  const [airFuelRatio, setAirFuelRatio] = useState(14.7) 
  const [excessO2, setExcessO2] = useState(2.0) 
  const [targetTemp, setTargetTemp] = useState(450) 
  const [currentTemp, setCurrentTemp] = useState(400) 
  const [inflowTemp, setInflowTemp] = useState(150) // Changed from 25 to 150 (midpoint of new range)
  const [inflowRate, setInflowRate] = useState(100) 
  const [isOptimal, setIsOptimal] = useState(false) 
  const [fuelFlow, setFuelFlow] = useState(10) 
  const [airFlow, setAirFlow] = useState(147)
  const [targetFlowRate, setTargetFlowRate] = useState(100)
  const [flowRateOptimal, setFlowRateOptimal] = useState(false)
  const [tempHistory, setTempHistory] = useState([...Array(30)].map(() => 400))
  const [o2History, setO2History] = useState([...Array(30)].map(() => 2.0))
  const [manualInflowControl, setManualInflowControl] = useState(false)
  const [lastAction, setLastAction] = useState(null)

  // The optimal excess O2 range
  const optimalO2Min = 1.5
  const optimalO2Max = 2.5

  // When air/fuel ratio changes, update the corresponding flows
  useEffect(() => {
    // Keep fuel flow constant at 10 units, adjust air flow based on ratio
    setAirFlow(fuelFlow * airFuelRatio)
  }, [airFuelRatio, fuelFlow])

  // Calculate excess O2 based on heat transfer physics
  const calculateExcessO2 = useCallback((airFuelRatio, fuelFlow, currentTemp) => {
    // 1) Convert fuel flow to Nm³/s
    const fuel_s = fuelFlow / 3600;  

    // 2) Constants (adjusted for better physical model)
    const HHV = 39000;    // kJ per Nm³ of gas
    const U = 0.0005;     // kJ/s·m²·°C (1000x smaller than before)
    const A = 10;         // m² of heat-transfer surface (reduced from 30)
    const T_flame = 1800; // °C

    // 3) Efficiency from air/fuel ratio (Gaussian curve)
    const AFR_opt = 14.7;
    const sigma = 2;
    const eta = Math.exp(-Math.pow(airFuelRatio - AFR_opt, 2) / (2 * Math.pow(sigma, 2)));

    // 4) Heat rates
    const Q_comb = fuel_s * HHV * eta;                // heat available (includes efficiency)
    const Q_trans = U * A * (T_flame - currentTemp);  // heat captured

    // 5) Loss fraction → O₂ (directly proportional)
    const fracLost = Math.max(0, 1 - Q_trans / Math.max(Q_comb, 1e-6));
    const excessO2 = fracLost * 21; // 21% is max O2 in air

    // 6) Fluctuation & clamp
    const noise = (Math.random() - 0.5) * 0.4; // ±0.2% fluctuation
    return Math.max(0, parseFloat((excessO2 + noise).toFixed(1)));
  }, [])

  // Update the simulation every 333ms (3x faster than before)
  useEffect(() => {
    const simulationInterval = setInterval(() => {
      // Only vary inflow conditions if NOT in manual control mode
      if (!manualInflowControl) {
        const newInflowTemp = inflowTemp + (Math.random() - 0.5) * 10
        const newInflowRate = inflowRate + (Math.random() - 0.5) * 20
        
        // Constrain inflow temperature to 100-200°C
        setInflowTemp(Math.max(100, Math.min(200, newInflowTemp)))
        setInflowRate(Math.max(50, Math.min(200, newInflowRate))) // Keep within reasonable limits
      }
      
      // Calculate new excess O2 using the heat-balance approach
      const newO2 = calculateExcessO2(airFuelRatio, fuelFlow, currentTemp)
      setExcessO2(newO2)
      
      // Calculate new temperature using heat transfer model
      const newTemp = calculateTemperature(
        fuelFlow,
        airFlow,
        currentTemp,
        inflowTemp,
        inflowRate
      )
      setCurrentTemp(Math.round(newTemp))
      
      // Check if O2 level is in optimal range
      setIsOptimal(newO2 >= optimalO2Min && newO2 <= optimalO2Max)
      
      // Check if flow rate is in optimal range
      setFlowRateOptimal(Math.abs(inflowRate - targetFlowRate) < 15)
      
      // Update history (keep last 30 readings)
      setTempHistory(prev => [...prev.slice(1), Math.round(newTemp)])
      setO2History(prev => [...prev.slice(1), newO2])
      
    }, 333) // Changed from 1000ms to 333ms for 3x speed
    
    return () => clearInterval(simulationInterval)
  }, [
    airFuelRatio, 
    targetTemp, 
    currentTemp, 
    inflowTemp, 
    inflowRate, 
    calculateExcessO2,
    airFlow,
    fuelFlow,
    manualInflowControl,
    targetFlowRate
  ])

  // Get color class for temperature display based on how close to target
  const getTempColorClass = () => {
    const diff = Math.abs(currentTemp - targetTemp)
    if (diff < 30) return "border-green-500 text-green-600" 
    if (diff < 100) return "border-yellow-500 text-yellow-600"
    return "border-red-500 text-red-600"
  }

  // Get color class for O2 display based on if it's optimal
  const getO2ColorClass = () => {
    return isOptimal 
      ? "border-green-500 text-green-600" 
      : "border-red-500 text-red-600"
  }

  // Get flame color based on combustion conditions
  const getFlameColor = () => {
    if (excessO2 < optimalO2Min - 0.5) return "bg-red-500"
    if (excessO2 > optimalO2Max + 0.5) return "bg-blue-400"
    return "bg-orange-500"
  }
  
  // Create a function to handle air/fuel ratio changes
  const handleRatioChange = (newRatio) => {
    const oldRatio = airFuelRatio;
    setAirFuelRatio(newRatio);
    
    // Record what changed
    if (newRatio > oldRatio) {
      setLastAction("Increased air ratio → more excess O₂");
    } else if (newRatio < oldRatio) {
      setLastAction("Decreased air ratio → less excess O₂");
    }
  }

  // Create a function to handle fuel flow changes
  const handleFuelFlowChange = (newFuelFlow) => {
    setFuelFlow(newFuelFlow);
    // Maintain the same ratio, but adjust air flow proportionally
    setAirFlow(newFuelFlow * airFuelRatio);
    setLastAction(`Changed fuel flow to ${newFuelFlow} units`);
  }

  // Game related states and functions
  const [gameActive, setGameActive] = useState(false)
  const [gameCompleted, setGameCompleted] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300) // Changed from 600 to 300 (5 minutes in seconds)
  const [costSavings, setCostSavings] = useState(0)
  const [cumulativeO2, setCumulativeO2] = useState(0)
  const [cumulativeCO, setCumulativeCO] = useState(0)
  const [cumulativeCO2, setCumulativeCO2] = useState(0)
  const [showGameResults, setShowGameResults] = useState(false)
  
  // New game-related constants
  const optimalFuelUsage = 8000 // baseline cost in $ per hour at optimal conditions
  const gasPricePerUnit = 0.5 // $ per unit of fuel
  
  // Add new state variables to store final score snapshots
  const [finalTemp, setFinalTemp] = useState(0)
  const [finalO2, setFinalO2] = useState(0)
  const [finalCostSavings, setFinalCostSavings] = useState(0)
  const [finalCO, setFinalCO] = useState(0)
  const [finalCO2, setFinalCO2] = useState(0)
  const [finalTimeUsed, setFinalTimeUsed] = useState(0)

  // Function to start the game
  const startGame = () => {
    setGameActive(true)
    setGameCompleted(false)
    setTimeRemaining(300) // Changed from 600 to 300 (5 minutes in seconds)
    setCostSavings(0)
    setCumulativeO2(0)
    setCumulativeCO(0)
    setCumulativeCO2(0)
    setShowGameResults(false)
    
    // Reset to starting conditions
    setCurrentTemp(400)
    setTargetTemp(450)
    setAirFuelRatio(14.7)
    setFuelFlow(10)
    setTempHistory([...Array(30)].map(() => 400))
    setO2History([...Array(30)].map(() => 2.0))
    setLastAction("Game started! Reach the target temperature within 5 minutes while minimizing costs.")
  }
  
  // Calculate CO emissions based on excess O2
  const calculateCO = useCallback((excessO2) => {
    // CO increases exponentially as O2 decreases below optimal
    if (excessO2 < optimalO2Min) {
      // Exponential increase in CO as O2 approaches zero
      return Math.min(1000, 10 * Math.exp(2 * (optimalO2Min - excessO2)))
    } else if (excessO2 >= optimalO2Min && excessO2 <= optimalO2Max) {
      // In optimal range - minimal constant CO emission (no incremental increase)
      return 1; // Minimal baseline CO when in optimal range
    } else {
      // Above optimal range - slight increase due to inefficiency
      return 3 + (excessO2 - optimalO2Max); // Small baseline plus slight increase
    }
  }, [optimalO2Min, optimalO2Max])
  
  // Calculate CO2 emissions based on fuel flow and combustion efficiency
  const calculateCO2 = useCallback((fuelFlow, airFuelRatio) => {
    // Basic CO2 calculation - increases with fuel flow
    const AFR_opt = 14.7
    const efficiency = Math.exp(-Math.pow(airFuelRatio - AFR_opt, 2) / (2 * Math.pow(2, 2)))
    
    // CO2 in kg/hr (simplified model)
    return fuelFlow * 2.5 * efficiency * 60
  }, [])
  
  // Calculate cost savings or losses based on excess O2
  const calculateCostImpact = useCallback((excessO2, fuelFlow) => {
    // Baseline cost at optimal O2
    const optimalCost = optimalFuelUsage / 3600 // per second
    
    // Cost impact based on how far from optimal range
    let costMultiplier = 1
    
    if (excessO2 < optimalO2Min) {
      // Incomplete combustion when O2 is too low - wasted fuel
      costMultiplier = 1 + 0.5 * (optimalO2Min - excessO2) / optimalO2Min
    } else if (excessO2 > optimalO2Max) {
      // Too much excess air - inefficient heating
      costMultiplier = 1 + 0.2 * (excessO2 - optimalO2Max) / optimalO2Max
    } else {
      // In optimal range - generate savings
      costMultiplier = 0.8
    }
    
    // Return cost impact (negative = savings, positive = additional cost)
    // Scaled by current fuel flow relative to "standard" flow (10)
    const actualCost = optimalCost * costMultiplier * (fuelFlow / 10)
    return (optimalCost - actualCost)
  }, [optimalO2Min, optimalO2Max])
  
  // Timer effect for the game
  useEffect(() => {
    if (!gameActive) return
    
    const gameTimer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(gameTimer)
          setGameActive(false)
          setGameCompleted(true)
          // Take snapshots of current values
          setFinalTemp(currentTemp)
          setFinalO2(excessO2)
          setFinalCostSavings(costSavings)
          setFinalCO(cumulativeCO)
          setFinalCO2(cumulativeCO2)
          setFinalTimeUsed(300) // Full time used
          setShowGameResults(true)
          setLastAction("Time's up! Check your results.")
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(gameTimer)
  }, [gameActive, currentTemp, excessO2, costSavings, cumulativeCO, cumulativeCO2])

  // Modify the temperature target check to take snapshots when target is reached
  useEffect(() => {
    // Only check if game is active and not already completed
    if (gameActive && !gameCompleted && Math.abs(currentTemp - targetTemp) < 5) {
      setGameActive(false)
      setGameCompleted(true)
      // Take snapshots of current values
      setFinalTemp(currentTemp)
      setFinalO2(excessO2)
      setFinalCostSavings(costSavings)
      setFinalCO(cumulativeCO)
      setFinalCO2(cumulativeCO2)
      setFinalTimeUsed(300 - timeRemaining) // Time used until completion
      setShowGameResults(true)
      setLastAction(`Success! Target temperature reached with ${formatTime(timeRemaining)} remaining.`)
    }
  }, [gameActive, gameCompleted, currentTemp, targetTemp, timeRemaining, excessO2, costSavings, cumulativeCO, cumulativeCO2])

  // Update the calculateGrade function to use final snapshots
  const calculateGrade = () => {
    // Base score out of 100
    let score = 0;
    
    // Temperature accuracy (up to 40 points)
    const tempAccuracy = Math.abs(finalTemp - targetTemp);
    if (tempAccuracy < 5) {
      score += 40; // Perfect temperature control
    } else if (tempAccuracy < 10) {
      score += 35; // Very good temperature control
    } else if (tempAccuracy < 20) {
      score += 25; // Good temperature control
    } else if (tempAccuracy < 30) {
      score += 15; // Fair temperature control
    } else {
      score += 5;  // Poor temperature control
    }
    
    // Financial impact (up to 30 points)
    if (finalCostSavings > 20) {
      score += 30; // Excellent efficiency
    } else if (finalCostSavings > 15) {
      score += 25; // Very good efficiency
    } else if (finalCostSavings > 10) {
      score += 20; // Good efficiency
    } else if (finalCostSavings > 5) {
      score += 15; // Moderate efficiency
    } else if (finalCostSavings > 0) {
      score += 10; // Slight efficiency
    } else {
      score += 0;  // No savings or loss
    }
    
    // Environmental impact (up to 30 points)
    if (finalCO < 100) {
      score += 30; // Excellent emissions control
    } else if (finalCO < 200) {
      score += 25; // Very good emissions control
    } else if (finalCO < 300) {
      score += 20; // Good emissions control
    } else if (finalCO < 400) {
      score += 10; // Fair emissions control
    } else {
      score += 0;  // Poor emissions control
    }
    
    // Convert score to letter grade
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  // Helper function to format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="min-h-screen w-full bg-[#f4e3c3]">
      <div className="max-w-6xl mx-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <img src={logoFC} className="h-30 mr-4" alt="Furnace Commander logo" />
            <h1 className="text-3xl font-bold text-gray-800">Furnace Simulator</h1>
          </div>
          
          {/* Game Controls */}
          <div className="flex items-center gap-4">
            {!gameActive && !gameCompleted && (
              <button 
                onClick={startGame}
                className="bg-green-600 text-gray-700 px-4 py-2 rounded hover:bg-green-700"
              >
                Start Challenge
              </button>
            )}
            
            {(gameActive || gameCompleted) && (
              <div className="flex flex-col items-end">
                <div className={`text-xl font-bold ${timeRemaining < 60 ? 'text-red-600' : 'text-gray-800'}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-sm text-gray-600">Time Remaining</div>
              </div>
            )}
          </div>
        </header>
        
        {lastAction && (
          <div className="mb-4 p-2 bg-blue-50 border-l-4 border-blue-400 text-blue-700">
            {lastAction}
          </div>
        )}
        
        {/* Game status panel */}
        {(gameActive || gameCompleted) && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">Target Status</div>
                <div className="flex items-center">
                  <div className={`text-lg font-bold ${Math.abs(currentTemp - targetTemp) < 10 ? 'text-green-600' : 'text-orange-600'}`}>
                    {Math.abs(currentTemp - targetTemp) < 10 ? 'On Target' : `${Math.abs(currentTemp - targetTemp)}°C off`}
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
                <div className={`text-lg font-bold ${cumulativeCO < 300 ? 'text-green-600' : 'text-red-600'}`}>
                  {cumulativeCO.toFixed(1)} kg
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">CO₂ Emissions</div>
                <div className="text-lg font-bold text-gray-800">
                  {cumulativeCO2.toFixed(1)} kg
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Game results modal */}
        {showGameResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full">
              <h2 className="text-2xl font-bold mb-4">Challenge Results</h2>
              
              {/* Add grade display at the top */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">
                  {gameCompleted && Math.abs(currentTemp - targetTemp) < 10 
                    ? '✅ Target Temperature Reached!' 
                    : '❌ Failed to Reach Target Temperature'}
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-sm font-medium text-gray-500">Overall Grade</div>
                  <div className={`text-4xl font-bold ${
                    calculateGrade() === 'A' ? 'text-green-600' :
                    calculateGrade() === 'B' ? 'text-green-500' :
                    calculateGrade() === 'C' ? 'text-yellow-500' :
                    calculateGrade() === 'D' ? 'text-orange-500' :
                    'text-red-600'
                  }`}>
                    {calculateGrade()}
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="text-gray-600">
                  Final temperature: {currentTemp}°C (Target: {targetTemp}°C)
                </div>
                <div className="text-gray-600">
                  Time used: {formatTime(300 - timeRemaining)} {timeRemaining > 0 && `(${formatTime(timeRemaining)} remaining)`}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="font-medium">Financial Impact:</div>
                  <div className={`text-xl font-bold ${costSavings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {costSavings > 0 ? 'Saved ' : 'Lost '}{Math.abs(costSavings).toFixed(2)} $
                  </div>
                </div>
                
                <div>
                  <div className="font-medium">Environmental Impact:</div>
                  <div className={`text-lg ${cumulativeCO < 300 ? 'text-green-600' : 'text-red-600'}`}>
                    CO: {cumulativeCO.toFixed(1)} kg
                  </div>
                  <div className="text-gray-700">
                    CO₂: {cumulativeCO2.toFixed(1)} kg
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="font-medium mb-1">Performance Analysis:</div>
                <div className="text-sm">
                  {costSavings > 0 && cumulativeCO < 300 
                    ? "Excellent job! You maintained efficient combustion while reaching the target temperature."
                    : costSavings > 0 
                      ? "Good financial savings, but CO emissions were high. Try improving your air/fuel ratio control."
                      : cumulativeCO < 300 
                        ? "Low emissions, but not cost-effective. You might have used too much excess air."
                        : "Poor performance in both cost and emissions. Review your combustion control strategy."
                  }
                </div>
              </div>
              
              {/* Grade breakdown */}
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <div className="font-medium mb-2">Grade Breakdown:</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="font-medium">Temperature</div>
                    <div className={Math.abs(currentTemp - targetTemp) < 10 ? "text-green-600" : "text-red-600"}>
                      {Math.abs(currentTemp - targetTemp) < 5 ? "Perfect" : 
                       Math.abs(currentTemp - targetTemp) < 10 ? "Very Good" : 
                       Math.abs(currentTemp - targetTemp) < 20 ? "Good" : 
                       Math.abs(currentTemp - targetTemp) < 30 ? "Fair" : "Poor"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Financial</div>
                    <div className={costSavings > 0 ? "text-green-600" : "text-red-600"}>
                      {costSavings > 20 ? "Excellent" : 
                       costSavings > 15 ? "Very Good" : 
                       costSavings > 10 ? "Good" : 
                       costSavings > 5 ? "Moderate" : 
                       costSavings > 0 ? "Slight" : "Loss"}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Emissions</div>
                    <div className={cumulativeCO < 300 ? "text-green-600" : "text-red-600"}>
                      {cumulativeCO < 100 ? "Excellent" : 
                       cumulativeCO < 200 ? "Very Good" : 
                       cumulativeCO < 300 ? "Good" : 
                       cumulativeCO < 400 ? "Fair" : "Poor"}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between">
                <button
                  className="bg-blue-600 text-gray-700 px-4 py-2 rounded hover:bg-blue-700"
                  onClick={() => startGame()}
                >
                  Try Again
                </button>
                <button
                  className="bg-gray-500 text-gray-700 px-4 py-2 rounded hover:bg-gray-600"
                  onClick={() => setShowGameResults(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="flex flex-col lg:flex-row gap-8">
          <div className="flex-grow flex flex-col items-center gap-6">
            <div className="flex w-full justify-center gap-4">
              <div className="bg-white p-3 rounded-lg shadow text-center min-w-[140px]">
                <span className="text-sm text-gray-600">Inflow Temperature:</span>
                <div className="text-xl font-semibold text-orange-600">{Math.round(inflowTemp)}°C</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow text-center min-w-[140px]">
                <span className="text-sm text-gray-600">Inflow Rate:</span>
                <div className="text-xl font-semibold text-orange-600">{Math.round(inflowRate)} units/h</div>
              </div>
            </div>
            
            {/* Interactive furnace visualization */}
            <div className="relative">
              <img 
                src={furnaceImg} 
                alt="Furnace" 
                className="max-h-[400px] w-auto rounded-lg shadow-lg"
              />
              
              {/* Dynamic flame visualization */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3">
                <div 
                  className={`mx-auto ${getFlameColor()} rounded-t-full animate-pulse shadow-lg`}
                  style={{
                    height: `${Math.min(100, currentTemp / 12)}px`,
                    opacity: fuelFlow < 5 ? 0.5 : 1,
                    width: `${50 + (fuelFlow * 3)}px`,
                  }}
                >
                </div>
                
                {/* Smoke when combustion is poor */}
                {(excessO2 < 1 || excessO2 > 3) && (
                  <div className="absolute -top-28 left-0 w-full h-28 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className="absolute w-4 h-4 bg-gray-300/50 rounded-full opacity-50"
                        style={{
                          left: `${20 + (i * 15)}%`,
                          animation: `rise ${2 + i * 0.5}s infinite`,
                          animationDelay: `${i * 0.5}s`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex w-full justify-center gap-6 flex-wrap">
              <div className={`bg-white p-4 rounded-lg shadow flex-1 min-w-[180px] border-l-4 ${getTempColorClass()}`}>
                <span className="text-gray-600">Current Temperature:</span>
                <div className={`text-2xl font-bold ${Math.abs(currentTemp - targetTemp) < 30 ? 'text-green-600' : 'text-orange-600'}`}>
                  {currentTemp}°C
                </div>
                <span className="text-xs text-gray-500">Target: {targetTemp}°C</span>
              </div>
              <div className={`bg-white p-4 rounded-lg shadow flex-1 min-w-[180px] border-l-4 ${getO2ColorClass()}`}>
                <span className="text-gray-600">Excess O₂:</span>
                <div className={`text-2xl font-bold ${isOptimal ? 'text-green-600' : 'text-red-600'}`}>
                  {excessO2.toFixed(1)}%
                </div>
                <span className="text-xs text-gray-500">Optimal: {optimalO2Min}-{optimalO2Max}%</span>
              </div>
              <div className={`bg-white p-4 rounded-lg shadow flex-1 min-w-[180px] border-l-4 ${flowRateOptimal ? 'border-green-500' : 'border-red-500'}`}>
                <span className="text-gray-600">Current Flow Rate:</span>
                <div className={`text-2xl font-bold ${flowRateOptimal ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.round(inflowRate)} units/h
                </div>
                <span className="text-xs text-gray-500">Target: {targetFlowRate} ±15 units/h</span>
              </div>
            </div>
            
            {/* Performance history charts */}
            <div className="w-full bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2 text-gray-700">Performance History</h3>
              <div className="flex gap-4 h-32">
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-1">Temperature</div>
                  <div className="relative h-24 border-b border-gray-300">
                    {/* Target temperature line */}
                    <div 
                      className="absolute w-full border-t border-dashed border-green-500 z-10"
                      style={{ bottom: `${((targetTemp) / 1200) * 100}%` }}
                    ></div>
                    
                    {/* Temperature history bars */}
                    <div className="flex h-full items-end w-full">
                      {tempHistory.map((temp, i) => (
                        <div 
                          key={i}
                          className="flex-1 bg-orange-500 rounded-t-sm mx-px transition-all duration-300"
                          style={{ 
                            height: `${Math.max(0, Math.min(100, ((temp) / 1200) * 100))}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-1">Excess O₂</div>
                  <div className="relative h-24 border-b border-gray-300">
                    {/* Optimal O2 zone */}
                    <div 
                      className="absolute w-full bg-green-100 border-y border-dashed border-green-500"
                      style={{ 
                        bottom: `${(optimalO2Min / 5) * 100}%`,
                        height: `${((optimalO2Max - optimalO2Min) / 5) * 100}%`
                      }}
                    ></div>
                    
                    {/* O2 history bars */}
                    <div className="flex h-full items-end w-full">
                      {o2History.map((o2, i) => (
                        <div 
                          key={i}
                          className={`flex-1 mx-px rounded-t-sm transition-all duration-300 ${
                            o2 >= optimalO2Min && o2 <= optimalO2Max 
                              ? 'bg-green-500' 
                              : 'bg-blue-500'
                          }`}
                          style={{ 
                            height: `${Math.min(100, (o2 / 5) * 100)}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg lg:w-1/3">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Furnace Controls</h2>
            
            {/* Fuel flow control */}
            <div className="mb-6 relative">
              <div className="flex justify-between items-center mb-2">
                <label className="font-medium text-gray-700">Fuel Flow: {fuelFlow.toFixed(1)} units</label>
                <button
                  className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                  onClick={() => handleFuelFlowChange(10)}
                >
                  Reset
                </button>
              </div>
              
              <input 
                type="range" 
                className="w-full h-2 bg-gradient-to-r from-blue-300 to-red-500 rounded-lg appearance-none cursor-pointer"
                min="1" 
                max="20" 
                step="0.5" 
                value={fuelFlow}
                onChange={(e) => handleFuelFlowChange(Number(e.target.value))}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low Fuel</span>
                <span>High Fuel</span>
              </div>
            </div>
            
            {/* Enhanced Air/Fuel ratio control - updated for more flexibility */}
            <div className="mb-6 relative">
              <div className="flex justify-between items-center mb-2">
                <div className="relative group">
                  <label className="font-medium text-gray-700 flex items-center">
                    Air/Fuel Ratio:
                    <span className="ml-1 text-blue-500 cursor-help text-xs">ⓘ</span>
                  </label>
                  <div className="absolute left-0 -top-2 transform -translate-y-full w-64 bg-white p-3 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <p className="text-xs text-gray-700">
                      The optimal air/fuel ratio for complete combustion is around 14.7 (stoichiometric).
                      Too little air causes incomplete combustion and sooting. Too much air reduces efficiency.
                    </p>
                  </div>
                </div>
                
                {/* Added direct input field */}
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                    min="0.6"
                    max="25"
                    step="0.1"
                    value={airFuelRatio}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (value >= 0.6 && value <= 25) {
                        handleRatioChange(value);
                      }
                    }}
                  />
                  <button
                    className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                    onClick={() => handleRatioChange(14.7)}
                  >
                    Reset to 14.7
                  </button>
                </div>
              </div>
              
              <div className="relative py-5">
                <div className="h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded-lg"></div>
                
                {/* Tick marks for reference */}
                <div className="absolute w-full flex justify-between top-3 px-1">
                  {[0.6, 5, 10, 14.7, 20, 25].map((value) => (
                    <div 
                      key={value} 
                      className="h-2 w-0.5 bg-gray-400"
                      style={{ left: `${((value - 0.6) / 24.4) * 100}%` }}
                    />
                  ))}
                </div>
                
                <input 
                  type="range" 
                  className="absolute top-0 w-full h-12 opacity-0 cursor-pointer"
                  min="0.6" 
                  max="25" 
                  step="0.1" 
                  value={airFuelRatio}
                  onChange={(e) => handleRatioChange(Number(e.target.value))}
                />
                
                {/* Larger slider handle */}
                <div 
                  className="absolute w-8 h-8 bg-white border-2 border-gray-600 rounded-full shadow-lg -mt-3 transition-all"
                  style={{
                    left: `${((airFuelRatio - 0.6) / 24.4) * 100}%`,
                    transform: 'translateX(-50%)',
                    top: "-1px"
                  }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 mt-3">
                <div className="flex flex-col items-center">
                  <span>Rich</span>
                  <span>(More Fuel)</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600">0.6</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600">5</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600">10</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600 font-medium">14.7</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-600">20</span>
                </div>
                <div className="flex flex-col items-center">
                  <span>Lean</span>
                  <span>(More Air)</span>
                </div>
              </div>

              <div className="text-sm text-gray-500 mt-2">
                Current Air Flow: {airFlow.toFixed(1)} units
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block font-medium text-gray-700 mb-2">
                Target Temperature: {targetTemp}°C
              </label>
              <input 
                type="range" 
                className="w-full h-2 bg-gradient-to-r from-blue-300 via-yellow-400 to-red-500 rounded-lg appearance-none cursor-pointer"
                min="400" 
                max="500" 
                step="5" 
                value={targetTemp}
                onChange={(e) => setTargetTemp(Number(e.target.value))}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low (400°C)</span>
                <span>High (500°C)</span>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="font-medium text-gray-700">
                  Inflow Feed Control
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <span className="mr-2 text-sm text-gray-600">Auto</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={manualInflowControl}
                      onChange={() => setManualInflowControl(!manualInflowControl)} 
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </div>
                  <span className="ml-2 text-sm text-gray-600">Manual</span>
                </label>
              </div>
              
              {manualInflowControl && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-600 mb-1">
                      Inflow Temperature: {Math.round(inflowTemp)}°C
                    </label>
                    <input 
                      type="range" 
                      className="w-full h-2 bg-gradient-to-r from-blue-300 to-red-300 rounded-lg appearance-none cursor-pointer"
                      min="15" 
                      max="40" 
                      step="1" 
                      value={inflowTemp}
                      onChange={(e) => setInflowTemp(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Cold (15°C)</span>
                      <span>Hot (40°C)</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Inflow Rate: {Math.round(inflowRate)} units/h
                    </label>
                    <input 
                      type="range" 
                      className="w-full h-2 bg-gradient-to-r from-blue-300 to-red-300 rounded-lg appearance-none cursor-pointer"
                      min="50" 
                      max="200" 
                      step="5" 
                      value={inflowRate}
                      onChange={(e) => {
                        setInflowRate(Number(e.target.value))
                        setLastAction(`Changed inflow rate to ${e.target.value} units/h`)
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Low Flow</span>
                      <span>High Flow</span>
                    </div>
                  </div>
                </>
              )}
              
              {!manualInflowControl && (
                <div className="text-sm text-gray-600 italic">
                  System is automatically varying inflow conditions.
                  Toggle to manual mode to control these parameters yourself.
                </div>
              )}
            </div>
            
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2">Combustion Status</h3>
              <p className={`p-2 rounded font-medium ${isOptimal ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {isOptimal 
                  ? '✅ Optimal combustion efficiency' 
                  : '⚠️ Adjust air/fuel ratio to improve combustion'}
              </p>
              {!isOptimal && excessO2 < optimalO2Min && (
                <p className="text-sm italic text-orange-600 mt-2">
                  Hint: Increase air ratio for more oxygen
                </p>
              )}
              {!isOptimal && excessO2 > optimalO2Max && (
                <p className="text-sm italic text-orange-600 mt-2">
                  Hint: Decrease air ratio to reduce excess oxygen
                </p>
              )}
              
              {/* Simple visual to show O2 relationship with air/fuel ratio */}
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Current Combustion Zone:</div>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-right text-xs w-16">
                    <div>Rich</div>
                    <div className="text-red-500 font-medium">Incomplete</div>
                  </div>
                  <div className="w-32 h-3 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 rounded-full relative">
                    <div className="absolute h-5 w-0.5 bg-black top-1/2 -translate-y-1/2" 
                        style={{ left: `${((airFuelRatio - 0.6) / 24.4) * 100}%` }} />
                  </div>
                  <div className="text-xs w-16">
                    <div>Lean</div>
                    <div className="text-blue-500 font-medium">Excess O₂</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App