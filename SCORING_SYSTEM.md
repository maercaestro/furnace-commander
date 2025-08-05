# Furnace Commander - Player Scoring System

## Complete Scoring Table

| **Scoring Category** | **Weight** | **Performance Level** | **Criteria** | **Points Awarded** | **Formula/Logic** |
|---------------------|------------|----------------------|--------------|-------------------|-------------------|
| **Temperature Control** | **40/100** | Perfect | `|finalTemp - targetTemp| < 10°C` | 40 | Target: 450°C |
| | | Very Good | `10°C ≤ |finalTemp - targetTemp| < 20°C` | 35 | |
| | | Good | `20°C ≤ |finalTemp - targetTemp| < 25°C` | 25 | |
| | | Fair | `25°C ≤ |finalTemp - targetTemp| < 30°C` | 15 | |
| | | Poor | `|finalTemp - targetTemp| ≥ 30°C` | 5 | |
| **Economic Efficiency** | **30/100** | Excellent | `finalCostSavings > $10` | 30 | Baseline: $8000/hr = $2.22/sec |
| | | Very Good | `$5 < finalCostSavings ≤ $10` | 25 | `costSavings = optimalCost - actualCost` |
| | | Good | `$2 < finalCostSavings ≤ $5` | 20 | `actualCost = optimalCost × costMultiplier × (fuelFlow/10)` |
| | | Moderate | `$1.5 < finalCostSavings ≤ $2` | 15 | **Cost Multipliers:** |
| | | Slight | `$0 < finalCostSavings ≤ $1.5` | 10 | • O₂ < 1.5%: `1 + 0.5 × (1.5 - O₂)/1.5` |
| | | No Savings | `finalCostSavings ≤ $0` | 0 | • O₂ > 2.5%: `1 + 0.2 × (O₂ - 2.5)/2.5` |
| | | | | | • 1.5% ≤ O₂ ≤ 2.5%: `0.76` (24% savings) |
| **Environmental Impact** | **30/100** | Excellent | `finalCO < 600 kg` | 30 | **CO Calculation:** |
| | | Very Good | `600 ≤ finalCO < 700 kg` | 25 | • O₂ < 1.5%: `min(100, 6 × exp(1.6 × (1.5 - O₂)))` |
| | | Good | `700 ≤ finalCO < 800 kg` | 20 | • 1.5% ≤ O₂ ≤ 2.5%: `0` (zero emissions) |
| | | Fair | `800 ≤ finalCO < 1000 kg` | 10 | • O₂ > 2.5%: `1 + (O₂ - 2.5)` |
| | | Poor | `finalCO ≥ 1000 kg` | 0 | |

## Letter Grade Conversion

| **Score Range** | **Letter Grade** |
|----------------|------------------|
| 90-100 | A |
| 80-89 | B |
| 70-79 | C |
| 60-69 | D |
| 0-59 | F |

## Key Game Parameters

| **Parameter** | **Value** | **Description** |
|---------------|-----------|-----------------|
| Target Temperature | 450°C | Primary objective |
| Optimal O₂ Range | 1.5% - 2.5% | For maximum efficiency and minimum emissions |
| Optimal Air/Fuel Ratio | 14.7 | Stoichiometric ratio for complete combustion |
| Game Duration | 300 seconds | 5 minutes maximum |
| Baseline Fuel Cost | $8,000/hour | $2.22/second at optimal conditions |
| Standard Fuel Flow | 10 units | Reference for cost scaling |

## Optimal Strategy Summary

To achieve **maximum score (100 points)**:

1. **Temperature Accuracy (40 pts):** Maintain temperature within ±10°C of 450°C target
2. **Cost Efficiency (30 pts):** Keep O₂ levels between 1.5-2.5% to generate >$10 in savings
3. **Emissions Control (30 pts):** Maintain optimal O₂ range to keep CO emissions below 600 kg

**Key Insight:** The optimal O₂ range (1.5-2.5%) simultaneously maximizes cost savings and minimizes CO emissions while enabling precise temperature control through proper air/fuel ratio management around 14.7.
