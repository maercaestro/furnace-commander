import React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import logoFC from './assets/logo_fc.png'
import furnaceImg from './assets/furnace.png'
import './App.css'
import { supabase } from './supabaseClient'

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
  // Add the missing state for instructions popup
  const [showInstructions, setShowInstructions] = useState(false)

  // Move game-related states up here, before they're used in effects
  const [gameActive, setGameActive] = useState(false)
  const [gameCompleted, setGameCompleted] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(300) // Changed from 600 to 300 (5 minutes in seconds)
  const [costSavings, setCostSavings] = useState(0)
  const [cumulativeO2, setCumulativeO2] = useState(0)
  const [cumulativeCO, setCumulativeCO] = useState(0)
  const [cumulativeCO2, setCumulativeCO2] = useState(0)
  const [showGameResults, setShowGameResults] = useState(false)
  
  // Add new state variables to store final score snapshots
  const [finalTemp, setFinalTemp] = useState(0)
  const [finalO2, setFinalO2] = useState(0)
  const [finalCostSavings, setFinalCostSavings] = useState(0)
  const [finalCO, setFinalCO] = useState(0)
  const [finalCO2, setFinalCO2] = useState(0)
  const [finalTimeUsed, setFinalTimeUsed] = useState(0)

  const [playerName, setPlayerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState(null)

  // Add a new state for feedback
  const [playerFeedback, setPlayerFeedback] = useState('');
  
  // Add state for mobile UI toggles
  const [showPerformanceCharts, setShowPerformanceCharts] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  // The optimal excess O2 range
  const optimalO2Min = 1.5
  const optimalO2Max = 2.5

  // New game-related constants
  const optimalFuelUsage = 8000 // baseline cost in $ per hour at optimal conditions
  const gasPricePerUnit = 0.5 // $ per unit of fuel

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

  // Refs to hold the latest values for simulation and timer
  const currentTempRef   = useRef(currentTemp)
  const inflowTempRef    = useRef(inflowTemp)
  const inflowRateRef    = useRef(inflowRate)
  const excessO2Ref      = useRef(excessO2)
  const costSavingsRef   = useRef(costSavings)
  const cumulativeCORef  = useRef(cumulativeCO)
  const cumulativeCO2Ref = useRef(cumulativeCO2)

  // Sync refs when state updates
  useEffect(() => { currentTempRef.current   = currentTemp },   [currentTemp])
  useEffect(() => { inflowTempRef.current    = inflowTemp },    [inflowTemp])
  useEffect(() => { inflowRateRef.current    = inflowRate },    [inflowRate])
  useEffect(() => { excessO2Ref.current      = excessO2 },      [excessO2])
  useEffect(() => { costSavingsRef.current   = costSavings },   [costSavings])
  useEffect(() => { cumulativeCORef.current  = cumulativeCO },  [cumulativeCO])
  useEffect(() => { cumulativeCO2Ref.current = cumulativeCO2 }, [cumulativeCO2])

  // Update the simulation every 333ms (3x faster than before)
  useEffect(() => {
    if (!gameActive) return

    const tick = 333 / 1000 // seconds per frame
    const simInterval = setInterval(() => {
      // 1) randomize inflow if in auto mode
      if (!manualInflowControl) {
        const newTemp = inflowTempRef.current + (Math.random() - 0.5) * 5  // Reduced from ±10 to ±5
        const newRate = inflowRateRef.current + (Math.random() - 0.5) * 5   // Reduced from ±20 to ±5
        setInflowTemp(Math.max(100, Math.min(200, newTemp)))
        setInflowRate(Math.max(50, Math.min(200, newRate)))
      }

      // 2) compute O₂ and temperature
      const o2    = calculateExcessO2(airFuelRatio, fuelFlow, currentTempRef.current)
      const temp  = calculateTemperature(
        fuelFlow,
        airFlow,
        currentTempRef.current,
        inflowTempRef.current,
        inflowRateRef.current
      )

      // 3) accumulate cost & emissions (scale by tick)
      const deltaCost = calculateCostImpact(o2, fuelFlow) * tick
      const deltaCO   = calculateCO(o2) * tick
      const deltaCO2  = calculateCO2(fuelFlow, airFuelRatio) * tick
      setCostSavings(prev => prev + deltaCost)
      setCumulativeCO(prev => prev + deltaCO)
      setCumulativeCO2(prev => prev + deltaCO2)

      // 4) update state & history
      setExcessO2(o2)
      setCurrentTemp(Math.round(temp))
      setIsOptimal(o2 >= optimalO2Min && o2 <= optimalO2Max)
      setFlowRateOptimal(Math.abs(inflowRateRef.current - targetFlowRate) < 15)
      setTempHistory(h => [...h.slice(1), Math.round(temp)])
      setO2History(h => [...h.slice(1), o2])
      
      // 5) check if target reached during game
      if (gameActive && !gameCompleted && Math.abs(temp - targetTemp) < 5) {
        handleGameComplete();
        setLastAction(`Success! Target temperature reached with ${formatTime(timeRemaining)} remaining.`);
      }
    }, 333)

    return () => clearInterval(simInterval)
  }, [gameActive, gameCompleted, manualInflowControl, airFuelRatio, fuelFlow, airFlow, targetFlowRate, targetTemp, timeRemaining])

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

  useEffect(() => {
    if (showGameResults) {
      fetchLeaderboard();
    }
  }, [showGameResults]);


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

  // Show instructions when clicking Start Challenge button
  const handleStartClick = () => {
    setShowInstructions(true)
  }

  // Calculate CO emissions based on excess O2
  const calculateCO = useCallback((excessO2) => {
    // CO increases exponentially as O2 decreases below optimal
    if (excessO2 < optimalO2Min) {
      // Exponential increase in CO as O2 approaches zero
      return Math.min(100, 6 * Math.exp(1.6 * (optimalO2Min - excessO2)))
    } else if (excessO2 >= optimalO2Min && excessO2 <= optimalO2Max) {
      // In optimal range - minimal constant CO emission with NO incremental increase
      return 0; // Zero CO emissions in optimal range
    } else {
      // Above optimal range - slight increase due to inefficiency
      return 1 + (excessO2 - optimalO2Max); // Small baseline plus slight increase
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
      costMultiplier = 0.76
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
  }, [gameActive]) // Only depend on gameActive state to avoid resetting the timer

  // Modify the temperature target check to take snapshots when target is reached
  useEffect(() => {
    // Only check if game is active and not already completed
    if (gameActive && !gameCompleted && Math.abs(currentTemp - targetTemp) < 5) {
      handleGameComplete();
      setLastAction(`Success! Target temperature reached with ${formatTime(timeRemaining)} remaining.`);
    }
  }, [gameActive, gameCompleted, currentTemp, targetTemp, timeRemaining, excessO2, costSavings, cumulativeCO, cumulativeCO2])
  
  const fetchLeaderboard = async () => {
    try {
      setLeaderboardLoading(true)
      setLeaderboardError(null)
      
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(10)
      
      if (error) {
        throw new Error(error)
      }
      
      setLeaderboard(data || [])
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLeaderboardError('Failed to load leaderboard data')
    } finally {
      setLeaderboardLoading(false)
    }
  }
  
  // Save player score to database
  const saveScore = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Calculate score for database
      const score = calculateNumericScore();
      
      const { error } = await supabase
        .from('leaderboard')
        .insert([
          {
            player_name: playerName,
            score: score,
            grade: calculateLetterGrade(score),
            final_temp: finalTemp,
            target_temp: targetTemp,
            cost_savings: finalCostSavings,
            co_emissions: finalCO,
            time_used: finalTimeUsed,
            feedback: playerFeedback.trim() || null // Add the feedback field
          }
        ]);
        
      if (error) {
        throw new Error(error);
      }
      
      // After saving, refresh the leaderboard
      setShowNameInput(false);
      setPlayerFeedback(''); // Reset feedback
      fetchLeaderboard();
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save your score. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stopGame = () => {
    setGameActive(false);
    setGameCompleted(true);
  
    // Take snapshots of current values
    setFinalTemp(currentTemp);
    setFinalO2(excessO2);
    setFinalCostSavings(costSavings);
    setFinalCO(cumulativeCO);
    setFinalCO2(cumulativeCO2);
    setFinalTimeUsed(300 - timeRemaining); // Time used until stopping
  
    setShowGameResults(true);
    setLastAction("Game stopped by user. Scores recorded.");
  };

  // Handle game completion
  const handleGameComplete = () => {
    setGameActive(false);
    setGameCompleted(true);
    
    // Take snapshots of current values
    setFinalTemp(currentTemp);
    setFinalO2(excessO2);
    setFinalCostSavings(costSavings);
    setFinalCO(cumulativeCO);
    setFinalCO2(cumulativeCO2);
    setFinalTimeUsed(300 - timeRemaining);
    
    setShowGameResults(true);
  }

  // Update the calculateGrade function to use final snapshots
  const calculateNumericScore = () => {
    // Base score out of 100
    let score = 0;
    
    console.log("Score calculation inputs:", {
      finalTemp,
      targetTemp,
      finalO2,
      finalCostSavings,
      finalCO
    });
    
    // Temperature accuracy (up to 40 points)
    const tempAccuracy = Math.abs(finalTemp - targetTemp);
    if (tempAccuracy < 10) {
      score += 40; // Perfect temperature control
    } else if (tempAccuracy < 20) {
      score += 35; // Very good temperature control
    } else if (tempAccuracy < 25) {
      score += 25; // Good temperature control
    } else if (tempAccuracy < 30) {
      score += 15; // Fair temperature control
    } else {
      score += 5;  // Poor temperature control
    }
    
    // Financial impact (up to 30 points)
    if (finalCostSavings > 10) {
      score += 30; // Excellent efficiency
    } else if (finalCostSavings > 5) {
      score += 25; // Very good efficiency
    } else if (finalCostSavings > 2) {
      score += 20; // Good efficiency
    } else if (finalCostSavings > 1.5) {
      score += 15; // Moderate efficiency
    } else if (finalCostSavings > 0) {
      score += 10; // Slight efficiency
    } else {
      score += 0;  // No savings or loss
    }
    
    // Environmental impact (up to 30 points)
    if (finalCO < 600) {
      score += 30; // Excellent emissions control
    } else if (finalCO < 700) {
      score += 25; // Very good emissions control
    } else if (finalCO < 800) {
      score += 20; // Good emissions control
    } else if (finalCO < 1000) {
      score += 10; // Fair emissions control
    } else {
      score += 0;  // Poor emissions control
    }
    
    console.log("Final calculated score:", score);
    
    return score;
  }


// Convert numeric score to letter grade
  const calculateLetterGrade = (score) => {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  const calculateGrade = () => {
    const score = calculateNumericScore()
    return calculateLetterGrade(score)
  }


  // Helper function to format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-6xl mx-auto p-3 sm:p-8">
        {/* Instructions Modal */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-4 sm:p-6 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">🔥 Furnace Challenge</h2>
              
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                  <h3 className="font-bold text-base sm:text-lg text-blue-200 mb-2">🎯 Objectives:</h3>
                  <ul className="list-disc pl-4 sm:pl-5 space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-200">
                    <li>Reach target <span className="font-medium text-yellow-300">{targetTemp}°C</span> within 5 minutes</li>
                    <li>Maintain O₂ levels <span className="font-medium text-green-300">1.5-2.5%</span> for optimal combustion</li>
                    <li>Keep cost impact positive</li>
                    <li>Minimize CO emissions</li>
                  </ul>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                  <h3 className="font-bold text-base sm:text-lg text-green-200 mb-2">💡 Tips:</h3>
                  <ul className="list-disc pl-4 sm:pl-5 space-y-1 sm:space-y-2 text-sm sm:text-base text-gray-200">
                    <li>Low temperature? Increase fuel flow</li>
                    <li>Adjust air/fuel ratio to maintain optimal O₂</li>
                    <li>Watch for smoke - indicates poor efficiency</li>
                    <li>Optimal air/fuel ratio is around 14.7</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
                <button
                  className="!bg-white/20 backdrop-blur-sm !text-white px-3 sm:px-4 py-2 rounded-xl hover:bg-white/30 text-sm sm:text-base order-2 sm:order-1 border border-white/30"
                  onClick={() => setShowInstructions(false)}
                >
                  Cancel
                </button>
                <button
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 text-sm sm:text-base order-1 sm:order-2 shadow-lg"
                  onClick={() => {
                    setShowInstructions(false)
                    startGame()
                  }}
                >
                  🚀 Start Challenge
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Modern Glassmorphism Header */}
        <header className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-3 sm:p-6 mb-4 sm:mb-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg p-2">
                <img 
                  src={logoFC} 
                  alt="Furnace Commander" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="hidden sm:block">
                  <h3 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    Furnace Commander
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300">Industrial Process Control</p>
                </div>
              </div>
            </div>
            
            {/* Modern Action Buttons */}
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              {!gameActive && !gameCompleted && (
                <>
                  <button 
                    onClick={handleStartClick}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-emerald-600 !text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 text-sm sm:text-base font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <span className="sm:hidden">🚀 Start</span>
                    <span className="hidden sm:inline">🚀 Start Challenge</span>
                  </button>
                  <button 
                    onClick={() => window.location.href = '/leaderboard'}
                    className="flex-1 sm:flex-none !bg-white/20 backdrop-blur-sm !text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:bg-white/30 text-sm sm:text-base font-semibold border border-white/30 transform hover:scale-105 transition-all duration-200"
                  >
                    <span className="sm:hidden">🏆 Scores</span>
                    <span className="hidden sm:inline">🏆 Leaderboard</span>
                  </button>
                  <button 
                    onClick={() => window.location.href = '/ai-demo'}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 text-sm sm:text-base font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <span className="sm:hidden">🤖 AI</span>
                    <span className="hidden sm:inline">🤖 AI Demo</span>
                  </button>
                </>
              )}
              {gameActive && (
                <button
                  onClick={stopGame}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-red-600 hover:to-pink-700 text-sm sm:text-base font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  ⏹️ Stop
                </button>
              )}
              {(gameActive || gameCompleted) && (
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-white/30">
                  <div className={`text-lg sm:text-xl font-bold ${timeRemaining < 60 ? 'text-red-300' : 'text-white'}`}>
                    ⏱️ {formatTime(timeRemaining)}
                  </div>
                  <div className="text-xs text-gray-300 hidden sm:block text-center">remaining</div>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {lastAction && (
          <div className="mb-4 p-3 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-xl text-blue-100 shadow-lg">
            💡 {lastAction}
          </div>
        )}
        
        {/* Modern Game Status Panel */}
        {(gameActive || gameCompleted) && (
          <div className="mb-4 sm:mb-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-3 sm:p-4 shadow-2xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-2 sm:p-3 rounded-xl border border-white/20">
                <div className="text-xs sm:text-sm text-gray-300">🎯 Target Status</div>
                <div className="flex items-center">
                  <div className={`text-sm sm:text-lg font-bold ${Math.abs(currentTemp - targetTemp) < 10 ? 'text-green-300' : 'text-orange-300'}`}>
                    {Math.abs(currentTemp - targetTemp) < 10 ? 'On Target' : `${Math.abs(currentTemp - targetTemp)}°C off`}
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm p-2 sm:p-3 rounded-xl border border-white/20">
                <div className="text-xs sm:text-sm text-gray-300">💰 Cost Impact</div>
                <div className={`text-sm sm:text-lg font-bold ${costSavings > 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {costSavings > 0 ? '+' : ''}${costSavings.toFixed(1)}
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm p-2 sm:p-3 rounded-xl border border-white/20">
                <div className="text-xs sm:text-sm text-gray-300">☠️ CO Emissions</div>
                <div className={`text-sm sm:text-lg font-bold ${cumulativeCO < 300 ? 'text-green-300' : 'text-red-300'}`}>
                  {cumulativeCO.toFixed(0)} kg
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm p-2 sm:p-3 rounded-xl border border-white/20">
                <div className="text-xs sm:text-sm text-gray-300">🌍 CO₂ Emissions</div>
                <div className="text-sm sm:text-lg font-bold text-gray-200">
                  {cumulativeCO2.toFixed(0)} kg
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Game results modal */}
        {showGameResults && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-4 sm:p-6 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white">🎉 Challenge Results</h2>
              
              {/* Add grade display at the top */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
                <div className="text-base sm:text-lg font-semibold text-white">
                  {gameCompleted && Math.abs(finalTemp - targetTemp) < 10 
                    ? '✅ Target Temperature Reached!' 
                    : '❌ Failed to Reach Target Temperature'}
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs sm:text-sm font-medium text-gray-300">Overall Grade</div>
                  <div className={`text-3xl sm:text-4xl font-bold ${
                    calculateGrade() === 'A' ? 'text-green-300' :
                    calculateGrade() === 'B' ? 'text-green-400' :
                    calculateGrade() === 'C' ? 'text-yellow-300' :
                    calculateGrade() === 'D' ? 'text-orange-300' :
                    'text-red-300'
                  }`}>
                    {calculateGrade()}
                  </div>
                </div>
              </div>
              
              <div className="mb-4 sm:mb-6 bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <div className="text-sm sm:text-base text-gray-200">
                  Final temperature: <span className="font-medium text-white">{finalTemp}°C</span> (Target: <span className="text-yellow-300">{targetTemp}°C</span>)
                </div>
                <div className="text-sm sm:text-base text-gray-200">
                  Time used: <span className="font-medium text-white">{formatTime(finalTimeUsed)}</span> {timeRemaining > 0 && `(${formatTime(timeRemaining)} remaining)`}
                </div>
              </div>
              
              
              {/* Name input and feedback for leaderboard */}
              {showNameInput ? (
                <div className="mb-4 sm:mb-6 bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                  <h3 className="font-semibold text-base sm:text-lg mb-2 text-white">Add Your Score to the Leaderboard</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm sm:text-base backdrop-blur-sm"
                        placeholder="Enter your name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={20}
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs sm:text-sm text-gray-300 mb-1">
                        Share your feedback (optional):
                      </label>
                      <textarea
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm sm:text-base backdrop-blur-sm"
                        placeholder="What did you think about the game? Any suggestions?"
                        value={playerFeedback}
                        onChange={(e) => setPlayerFeedback(e.target.value)}
                        rows={3}
                        maxLength={200}
                        disabled={isSubmitting}
                      ></textarea>
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 text-sm sm:text-base shadow-lg"
                        onClick={saveScore}
                        disabled={!playerName.trim() || isSubmitting}
                      >
                        {isSubmitting ? 'Saving...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 sm:mb-6">
                  <button
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 text-sm sm:text-base shadow-lg"
                    onClick={() => setShowNameInput(true)}
                  >
                    🏆 Add to Leaderboard
                  </button>
                </div>
              )}
              
              {/* Leaderboard display */}
              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold text-base sm:text-lg mb-2 text-white">🏆 Top 10 Leaderboard</h3>
                
                {leaderboardLoading ? (
                  <div className="text-center p-4 text-sm sm:text-base text-gray-300">Loading scores...</div>
                ) : leaderboardError ? (
                  <div className="text-center p-4 text-red-300 text-sm sm:text-base">{leaderboardError}</div>
                ) : leaderboard.length > 0 ? (
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm min-w-[300px]">
                        <thead className="bg-white/10 border-b border-white/20">
                          <tr>
                            <th className="py-1 sm:py-2 px-2 sm:px-4 text-left text-gray-200">#</th>
                            <th className="py-1 sm:py-2 px-2 sm:px-4 text-left text-gray-200">Player</th>
                            <th className="py-1 sm:py-2 px-2 sm:px-4 text-right text-gray-200">Score</th>
                            <th className="py-1 sm:py-2 px-2 sm:px-4 text-center text-gray-200">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((entry, index) => (
                            <tr key={entry.id} className={`${index % 2 === 0 ? 'bg-white/5' : 'bg-white/10'} hover:bg-white/20 transition-colors`}>
                              <td className="py-1 sm:py-2 px-2 sm:px-4 text-left text-gray-300">{index + 1}</td>
                              <td className="py-1 sm:py-2 px-2 sm:px-4 text-left font-medium truncate max-w-[80px] sm:max-w-none text-white">{entry.player_name}</td>
                              <td className="py-1 sm:py-2 px-2 sm:px-4 text-right text-gray-200">{entry.score}</td>
                              <td className="py-1 sm:py-2 px-2 sm:px-4 text-center">
                                <span className={`font-bold px-1 py-0.5 rounded text-xs ${
                                  entry.grade === 'A' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                                  entry.grade === 'B' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                  entry.grade === 'C' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                  entry.grade === 'D' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                                  'bg-red-500/20 text-red-300 border border-red-500/30'
                                }`}>
                                  {entry.grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 text-gray-300 text-sm sm:text-base bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">No scores yet. Be the first!</div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0">
                <button
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 text-sm sm:text-base order-2 sm:order-1 shadow-lg"
                  onClick={() => startGame()}
                >
                  🔄 Try Again
                </button>
                <button
                  className="!bg-white/20 backdrop-blur-sm !text-white px-3 sm:px-4 py-2 rounded-xl hover:bg-white/30 text-sm sm:text-base order-1 sm:order-2 border border-white/30"
                  onClick={() => {
                    setShowGameResults(false)
                    setGameCompleted(false)
                    setShowNameInput(false)
                    // Reset all game state
                    setTimeRemaining(300)
                    setCostSavings(0)
                    setCumulativeO2(0)
                    setCumulativeCO(0)
                    setCumulativeCO2(0)
                    
                    // Reset to starting conditions
                    setCurrentTemp(400)
                    setTargetTemp(450)
                    setAirFuelRatio(14.7)
                    setFuelFlow(10)
                    setAirFlow(147)
                    setTempHistory([...Array(30)].map(() => 400))
                    setO2History([...Array(30)].map(() => 2.0))
                    setLastAction(null)
                    
                    // Reset player name
                    setPlayerName('')
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="flex flex-col xl:flex-row gap-4 lg:gap-8">
          <div className="flex-grow flex flex-col items-center gap-4 lg:gap-6">
            {/* Modern Temperature Metrics - Grid layout on mobile - TOP PRIORITY */}
            <div className="w-full">
              {/* Mobile: 1x2 grid (side by side), Desktop: Single row */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row sm:justify-center gap-3 sm:gap-6">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-3 sm:p-4 rounded-xl shadow-lg sm:flex-1 sm:min-w-[180px] border-l-4 border-l-orange-400">
                  <span className="text-xs sm:text-base text-gray-300">🌡️ Temperature</span>
                  <div className={`text-xl sm:text-3xl font-bold ${Math.abs(currentTemp - targetTemp) < 30 ? 'text-green-300' : 'text-orange-300'}`}>
                    {currentTemp}°C
                  </div>
                  <span className="text-xs text-gray-400">Target: {targetTemp}°C</span>
                </div>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-3 sm:p-4 rounded-xl shadow-lg sm:flex-1 sm:min-w-[180px] border-l-4 border-l-blue-400">
                  <span className="text-xs sm:text-base text-gray-300">💨 Excess O₂</span>
                  <div className={`text-xl sm:text-3xl font-bold ${isOptimal ? 'text-green-300' : 'text-red-300'}`}>
                    {excessO2.toFixed(1)}%
                  </div>
                  <span className="text-xs text-gray-400">Optimal: {optimalO2Min}-{optimalO2Max}%</span>
                </div>
              </div>
            </div>
            
            {/* Interactive furnace visualization - Hidden on mobile for better UX */}
            <div className="relative w-full max-w-md mx-auto hidden sm:block">
              <img 
                src={furnaceImg} 
                alt="Furnace" 
                className="w-full h-auto max-h-[300px] sm:max-h-[400px] rounded-lg shadow-lg"
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
            
            {/* Desktop: Inflow Display and Performance Charts stay here */}
            <div className="hidden sm:block w-full">
              {/* Modern Inflow Display - Desktop only */}
              <div className={`w-full ${gameActive ? 'hidden sm:block' : 'block'} mb-6`}>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3 flex items-center gap-2">
                  📥 Inflow Conditions
                </h3>
                {/* Desktop: Single row */}
                <div className="flex flex-row justify-center gap-4">
                  <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-3 sm:p-4 rounded-xl shadow-lg text-center min-w-[140px]">
                    <span className="text-xs sm:text-sm text-gray-300">🌡️ Inflow Temp</span>
                    <div className="text-lg sm:text-xl font-bold text-orange-300">{Math.round(inflowTemp)}°C</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-3 sm:p-4 rounded-xl shadow-lg text-center min-w-[140px]">
                    <span className="text-xs sm:text-sm text-gray-300">🌊 Flow Rate</span>
                    <div className="text-lg sm:text-xl font-bold text-blue-300">{Math.round(inflowRate)} units/h</div>
                  </div>
                </div>
              </div>
              
              {/* Modern Performance Charts - Desktop only */}
              <div className="w-full !bg-white/10 backdrop-blur-lg border !border-white/20 rounded-2xl shadow-2xl">
                <div className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-lg font-semibold !text-white flex items-center gap-2">
                      📊 Performance History
                    </h3>
                  </div>
                  <div className="block">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 h-auto sm:h-32 mt-3">
                      <div className="flex-1 min-h-[100px] sm:min-h-0 bg-white/5 rounded-xl p-2 sm:p-3 border border-white/10">
                        <div className="text-xs sm:text-sm text-gray-300 mb-1 flex items-center gap-1">
                          🌡️ Temperature
                        </div>
                        <div className="relative h-16 sm:h-20 border-b border-white/20">
                          {/* Target temperature line */}
                          <div 
                            className="absolute w-full border-t border-dashed border-green-400 z-10"
                            style={{ bottom: `${((targetTemp) / 1200) * 100}%` }}
                          ></div>
                          
                          {/* Temperature history bars */}
                          <div className="flex h-full items-end w-full">
                            {tempHistory.map((temp, i) => (
                              <div 
                                key={i}
                                className="flex-1 bg-gradient-to-t from-orange-500 to-orange-300 rounded-t-sm mx-px transition-all duration-300"
                                style={{ 
                                  height: `${Math.max(0, Math.min(100, ((temp) / 1200) * 100))}%`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-h-[100px] sm:min-h-0 bg-white/5 rounded-xl p-2 sm:p-3 border border-white/10">
                        <div className="text-xs sm:text-sm text-gray-300 mb-1 flex items-center gap-1">
                          💨 Excess O₂
                        </div>
                        <div className="relative h-16 sm:h-20 border-b border-white/20">
                          {/* Optimal O2 zone */}
                          <div 
                            className="absolute w-full bg-green-400/20 border-y border-dashed border-green-400"
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
                                    ? 'bg-gradient-to-t from-green-500 to-green-300' 
                                    : 'bg-gradient-to-t from-blue-500 to-blue-300'
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
              </div>
            </div>
          </div>
          
          {/* Modern Controls Panel */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 sm:p-6 shadow-2xl xl:w-1/3">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
              🎛️ Furnace Controls
            </h2>
            
            {/* Essential controls - always visible */}
            <div className="space-y-4 sm:space-y-6">
              {/* Fuel flow control */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-medium text-white text-sm sm:text-base flex items-center gap-1">
                    ⛽ Fuel: {fuelFlow.toFixed(1)}
                  </label>
                  <button
                    className="text-xs !bg-white/20 backdrop-blur-sm !text-white px-2 py-1 rounded-lg hover:bg-white/30 border border-white/30"
                    onClick={() => handleFuelFlowChange(10)}
                  >
                    Reset
                  </button>
                </div>
                
                <input 
                  type="range" 
                  className="w-full h-3 sm:h-2 bg-gradient-to-r from-blue-400 to-red-500 rounded-lg appearance-none cursor-pointer touch-pan-x"
                  min="1" 
                  max="20" 
                  step="0.5" 
                  value={fuelFlow}
                  onChange={(e) => handleFuelFlowChange(Number(e.target.value))}
                />
                <div className="flex justify-between text-xs text-gray-300 mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              
              {/* Air/Fuel ratio control - with input option */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-medium text-white text-sm sm:text-base flex items-center gap-1">
                    💨 Air/Fuel: {airFuelRatio.toFixed(1)}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-16 sm:w-20 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 text-center"
                      placeholder="14.7"
                      min="0.6"
                      max="25"
                      step="0.1"
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0.6 && value <= 25) {
                          handleRatioChange(value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value) && value >= 0.6 && value <= 25) {
                            handleRatioChange(value);
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                
                <div className="relative py-3 sm:py-5">
                  <div className="h-3 sm:h-3 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 rounded-lg"></div>
                  
                  <input 
                    type="range" 
                    className="absolute top-0 w-full h-8 sm:h-12 opacity-0 cursor-pointer touch-pan-x"
                    min="0.6" 
                    max="25" 
                    step="0.1" 
                    value={airFuelRatio}
                    onChange={(e) => handleRatioChange(Number(e.target.value))}
                  />
                  
                  {/* Modern slider handle */}
                  <div 
                    className="absolute w-6 h-6 sm:w-8 sm:h-8 bg-white border-2 border-blue-400 rounded-full shadow-xl transition-all transform hover:scale-110"
                    style={{
                      left: `${((airFuelRatio - 0.6) / 24.4) * 100}%`,
                      transform: 'translateX(-50%)',
                      top: "-6px"
                    }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-gray-300">
                  <span>Rich</span>
                  <span className="hidden sm:inline text-yellow-300">14.7 (Optimal)</span>
                  <span>Lean</span>
                </div>
              </div>
            </div>
            
            {/* Advanced controls - collapsible on mobile */}
            <div className="mt-4 sm:mt-6">
              <button 
                className="sm:hidden w-full text-left text-sm font-medium !text-white py-3 !border-b !border-white/20 flex justify-between items-center !bg-white/5 backdrop-blur-sm rounded-xl px-3 mb-2"
                onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              >
                ⚙️ Advanced Controls
                <span className="text-sm">{showAdvancedControls ? '🔼' : '🔽'}</span>
              </button>
              
              <div className={`${showAdvancedControls ? 'block' : 'hidden'} sm:block space-y-4 sm:space-y-6`}>
                {/* Target temperature */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                  <label className="flex font-medium text-white mb-2 text-sm sm:text-base items-center gap-1">
                    🎯 Target: {targetTemp}°C
                  </label>
                  <input 
                    type="range" 
                    className="w-full h-2 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-lg appearance-none cursor-pointer"
                    min="400" 
                    max="500" 
                    step="5" 
                    value={targetTemp}
                    onChange={(e) => setTargetTemp(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-xs text-gray-300 mt-1">
                    <span>400°C</span>
                    <span>500°C</span>
                  </div>
                </div>
                
                {/* Inflow controls */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium text-white text-sm sm:text-base flex items-center gap-1">
                      🌊 Inflow Control
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <span className="mr-2 text-xs text-gray-300">Auto</span>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={manualInflowControl}
                          onChange={() => setManualInflowControl(!manualInflowControl)} 
                        />
                        <div className="w-8 h-4 sm:w-11 sm:h-6 bg-white/20 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 sm:after:h-5 sm:after:w-5 after:transition-all"></div>
                      </div>
                      <span className="ml-2 text-xs text-gray-300">Manual</span>
                    </label>
                  </div>
                  
                  {manualInflowControl ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="block text-xs sm:text-sm text-gray-300 mb-1">
                          🌡️ Temp: {Math.round(inflowTemp)}°C
                        </label>
                        <input 
                          type="range" 
                          className="w-full h-2 bg-gradient-to-r from-blue-400 to-red-400 rounded-lg appearance-none cursor-pointer"
                          min="100" 
                          max="200" 
                          step="1" 
                          value={inflowTemp}
                          onChange={(e) => setInflowTemp(Number(e.target.value))}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs sm:text-sm text-gray-300 mb-1">
                          🌊 Rate: {Math.round(inflowRate)} units/h
                        </label>
                        <input 
                          type="range" 
                          className="w-full h-2 bg-gradient-to-r from-blue-400 to-red-400 rounded-lg appearance-none cursor-pointer"
                          min="50" 
                          max="200" 
                          step="5" 
                          value={inflowRate}
                          onChange={(e) => {
                            setInflowRate(Number(e.target.value))
                            setLastAction(`Changed inflow rate to ${e.target.value} units/h`)
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm text-gray-300 italic">
                      ✨ System automatically varies inflow conditions
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Combustion status - simplified for mobile */}
            <div className="mt-4 sm:mt-8 bg-white/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
              <h3 className="font-semibold text-white mb-2 text-sm sm:text-base flex items-center gap-1">
                🔥 Combustion Status
              </h3>
              <p className={`p-2 sm:p-3 rounded-xl font-medium text-xs sm:text-sm ${isOptimal ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                {isOptimal 
                  ? '✅ Optimal combustion efficiency' 
                  : '⚠️ Adjust air/fuel ratio for better combustion'}
              </p>
              
              {/* Combustion zone indicator - modern design */}
              <div className="mt-3 sm:mt-4">
                <div className="text-xs text-gray-300 mb-2 flex items-center gap-1">
                  📊 Combustion Zone
                </div>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <div className="text-right text-xs w-12 sm:w-16">
                    <div className="text-red-300 font-medium">Rich</div>
                  </div>
                  <div className="w-20 sm:w-32 h-3 sm:h-4 bg-gradient-to-r from-red-400 via-green-400 to-blue-400 rounded-full relative shadow-lg">
                    <div className="absolute h-4 sm:h-6 w-1 bg-white rounded-full shadow-lg top-1/2 -translate-y-1/2 transition-all" 
                        style={{ left: `${((airFuelRatio - 0.6) / 24.4) * 100}%` }} />
                  </div>
                  <div className="text-xs w-12 sm:w-16">
                    <div className="text-blue-300 font-medium">Lean</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        
        {/* Mobile: Inflow Conditions and Performance Charts below controls */}
        <div className="sm:hidden space-y-4 mt-4">
          {/* Mobile Inflow Display */}
          <div className={`w-full ${gameActive ? 'hidden' : 'block'}`}>
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-2xl">
              <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                📥 Inflow Conditions
              </h3>
              {/* Mobile: 1x2 grid (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 rounded-xl text-center">
                  <span className="text-xs text-gray-300">🌡️ Inflow Temp</span>
                  <div className="text-lg font-bold text-orange-300">{Math.round(inflowTemp)}°C</div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 rounded-xl text-center">
                  <span className="text-xs text-gray-300">🌊 Flow Rate</span>
                  <div className="text-lg font-bold text-blue-300">{Math.round(inflowRate)} units/h</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mobile Performance Charts */}
          <div className="w-full">
            <div className="!bg-white/10 backdrop-blur-lg border !border-white/20 rounded-2xl shadow-2xl">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold !text-white flex items-center gap-2">
                    📊 Performance History
                  </h3>
                  <button 
                    className="text-xs text-blue-300 px-3 py-1 rounded-lg !bg-white/20 backdrop-blur-sm border !border-white/30"
                    onClick={() => setShowPerformanceCharts(!showPerformanceCharts)}
                  >
                    {showPerformanceCharts ? '🔼 Hide' : '🔽 Show'}
                  </button>
                </div>
                <div className={`${showPerformanceCharts ? 'block' : 'hidden'}`}>
                  <div className="flex flex-col gap-3 mt-3">
                    <div className="flex-1 min-h-[100px] bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-xs text-gray-300 mb-1 flex items-center gap-1">
                        🌡️ Temperature
                      </div>
                      <div className="relative h-16 border-b border-white/20">
                        {/* Target temperature line */}
                        <div 
                          className="absolute w-full border-t border-dashed border-green-400 z-10"
                          style={{ bottom: `${((targetTemp) / 1200) * 100}%` }}
                        ></div>
                        
                        {/* Temperature history bars */}
                        <div className="flex h-full items-end w-full">
                          {tempHistory.map((temp, i) => (
                            <div 
                              key={i}
                              className="flex-1 bg-gradient-to-t from-orange-500 to-orange-300 rounded-t-sm mx-px transition-all duration-300"
                              style={{ 
                                height: `${Math.max(0, Math.min(100, ((temp) / 1200) * 100))}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-h-[100px] bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-xs text-gray-300 mb-1 flex items-center gap-1">
                        💨 Excess O₂
                      </div>
                      <div className="relative h-16 border-b border-white/20">
                        {/* Optimal O2 zone */}
                        <div 
                          className="absolute w-full bg-green-400/20 border-y border-dashed border-green-400"
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
                                  ? 'bg-gradient-to-t from-green-500 to-green-300' 
                                  : 'bg-gradient-to-t from-blue-500 to-blue-300'
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App