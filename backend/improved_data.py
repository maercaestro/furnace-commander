import numpy as np
import pandas as pd
import os

def calculate_temperature(fuel_flow, air_flow, current_temp, inflow_temp, inflow_rate, noise_level=0.5):
    """Improved temperature calculation with realistic physics for heavier fuel gas (C3/C4 rich)"""
    fuel_s = fuel_flow / 3600.0
    inflow_s = inflow_rate / 3600.0
    
    # Constants adjusted for heavier fuel gas (C3/C4 rich, density 0.5-0.6)
    AFR_opt = 15.8                # Optimal AFR for heavier hydrocarbons (C3/C4)
    max_fuel_energy = 47000.0     # Higher heating value for C3/C4 (kJ/kg)
    fuel_density = 0.55           # Density of heavier fuel gas (kg/m³)
    furnace_mass = 5000.0
    specific_heat = 0.5
    heat_loss_coeff = 0.0005
    inlet_coeff = 0.0002
    ambient_temp = 25.0
    time_step = 1.0
    
    # Combustion efficiency with realistic constraints for heavier fuel gas
    AFR = air_flow / max(fuel_flow, 1e-3)
    
    # Adjusted efficiency curve for C3/C4 rich fuel (different optimal point)
    if AFR < 8.0:  # Too fuel-rich - incomplete combustion (adjusted for heavier gas)
        efficiency = 0.25 * np.exp(-(AFR - AFR_opt)**2 / (2 * 2.5**2))
    elif AFR > 22.0:  # Too lean - poor combustion (adjusted range)
        efficiency = 0.45 * np.exp(-(AFR - AFR_opt)**2 / (2 * 2.5**2))
    else:  # Normal range for heavier hydrocarbons
        efficiency = np.exp(-(AFR - AFR_opt)**2 / (2 * 2.0**2))
    
    # Heat calculations
    Q_comb = fuel_s * max_fuel_energy * efficiency * time_step
    Q_loss = heat_loss_coeff * (current_temp - ambient_temp) * time_step
    Q_inflow = inlet_coeff * inflow_s * (current_temp - inflow_temp) * time_step
    
    net_energy = Q_comb - Q_loss - Q_inflow
    temp_change = net_energy / (furnace_mass * specific_heat)
    
    # Realistic noise
    noise = (np.random.rand() - 0.5) * 2 * noise_level
    new_temp = current_temp + temp_change + noise
    
    return max(ambient_temp, new_temp)

def calculate_excess_o2(air_fuel_ratio, fuel_flow, current_temp, noise_level=0.1):
    """Improved O2 calculation with realistic physics for heavier fuel gas (C3/C4 rich)"""
    fuel_s = fuel_flow / 3600.0
    
    # Constants adjusted for heavier fuel gas
    HHV = 47000.0                 # Higher heating value for C3/C4 (kJ/kg)
    U = 0.0005
    A = 10.0
    T_flame = 1900.0              # Slightly higher flame temp for C3/C4
    AFR_opt = 15.8                # Optimal AFR for heavier hydrocarbons
    sigma = 2.0
    
    # Realistic efficiency with constraints for heavier fuel gas
    AFR = air_fuel_ratio
    if AFR < 8.0:  # Too fuel-rich (adjusted for C3/C4)
        eta = 0.15 * np.exp(-(AFR - AFR_opt)**2 / (2 * sigma**2))
    elif AFR > 22.0:  # Too lean (adjusted range)
        eta = 0.35 * np.exp(-(AFR - AFR_opt)**2 / (2 * sigma**2))
    else:
        eta = np.exp(-(AFR - AFR_opt)**2 / (2 * sigma**2))
    
    Q_comb = fuel_s * HHV * eta
    Q_trans = U * A * (T_flame - current_temp)
    
    frac_lost = max(0, 1 - Q_trans / max(Q_comb, 1e-6))
    excess_o2 = frac_lost * 21.0
    
    # Ensure realistic O2 levels for heavier fuel gas
    if AFR < 10.0:  # Very fuel-rich - low O2 (adjusted for C3/C4)
        excess_o2 = min(excess_o2, 1.5)
    elif AFR > 18.0:  # Very lean - high O2 (adjusted range)
        excess_o2 = max(excess_o2, 4.0)
    
    # Realistic noise
    noise = (np.random.rand() - 0.5) * 2 * noise_level
    return max(0.0, excess_o2 + noise)

def generate_realistic_sequences(num_sequences=5000, sequence_length=30):
    """Generate more realistic training sequences for heavier fuel gas (C3/C4 rich)"""
    
    # Realistic parameter ranges matching real plant data (heavier fuel gas)
    ranges = {
        'fuel_flow': (480.0, 650.0),    # Match real plant: 516-627 (heavier gas needs higher flow)
        'air_fuel_ratio': (10.0, 12.0), # Match real plant: 10.25-11.72 (narrower for C3/C4)
        'current_temp': (280.0, 300.0), # Match real plant: 286-296°C (realistic operating range)
        'inflow_temp': (255.0, 265.0),  # Match real plant: 259-262°C (inlet conditions)
        'inflow_rate': (135.0, 170.0)   # Match real plant: 141-165 (inlet flow range)
    }
    
    records = []
    
    for seq in range(num_sequences):
        # Start with random initial conditions
        fuel_flow = np.random.uniform(*ranges['fuel_flow'])
        afr = np.random.uniform(*ranges['air_fuel_ratio'])
        current_temp = np.random.uniform(*ranges['current_temp'])
        inflow_temp = np.random.uniform(*ranges['inflow_temp'])
        inflow_rate = np.random.uniform(*ranges['inflow_rate'])
        air_flow = fuel_flow * afr
        
        for t in range(sequence_length):
            # Calculate next states
            next_temp = calculate_temperature(
                fuel_flow, air_flow, current_temp, inflow_temp, inflow_rate
            )
            next_o2 = calculate_excess_o2(afr, fuel_flow, current_temp)
            
            records.append({
                'sequence': seq,
                'timestep': t,
                'fuel_flow': fuel_flow,
                'air_fuel_ratio': afr,
                'current_temp': current_temp,
                'inflow_temp': inflow_temp,
                'inflow_rate': inflow_rate,
                'next_temp': next_temp,
                'next_excess_o2': next_o2
            })
            
            # Update for next timestep with realistic variations
            current_temp = next_temp
            
            # Allow parameters to change slightly during sequence (more realistic for heavier gas)
            if t % 5 == 0:  # Change every 5 steps
                fuel_flow += np.random.normal(0, 15.0)  # Larger changes for heavier gas flow
                afr += np.random.normal(0, 0.1)         # Smaller AFR changes (tighter control)
                fuel_flow = np.clip(fuel_flow, *ranges['fuel_flow'])
                afr = np.clip(afr, *ranges['air_fuel_ratio'])
                air_flow = fuel_flow * afr
            
            # Inflow conditions change gradually (matching real plant behavior)
            inflow_temp += np.random.normal(0, 1.0)  # Smaller temperature variations
            inflow_rate += np.random.normal(0, 5.0)  # Moderate flow variations
            inflow_temp = np.clip(inflow_temp, *ranges['inflow_temp'])
            inflow_rate = np.clip(inflow_rate, *ranges['inflow_rate'])
    
    return pd.DataFrame(records)

if __name__ == "__main__":
    print("Generating improved training data for heavier fuel gas (C3/C4 rich)...")
    print("Adjusted parameters:")
    print("  - Fuel density: 0.55 kg/m³")
    print("  - Heating value: 47,000 kJ/kg")
    print("  - Optimal AFR: 15.8")
    print("  - Fuel flow range: 480-650 (matching real plant)")
    print("  - AFR range: 10.0-12.0 (matching real plant)")
    print("  - Temperature range: 280-300°C (matching real plant)")
    
    df = generate_realistic_sequences()
    
    # Save data
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_path = os.path.join(data_dir, 'improved_training_data_heavy_gas.csv')
    df.to_csv(output_path, index=False)
    
    print(f"\nGenerated {len(df)} training samples")
    print(f"Saved to: {output_path}")
    
    # Print statistics
    print(f"\nData quality check for heavier fuel gas:")
    print(f"Fuel flow range: {df['fuel_flow'].min():.1f} - {df['fuel_flow'].max():.1f}")
    print(f"AFR range: {df['air_fuel_ratio'].min():.1f} - {df['air_fuel_ratio'].max():.1f}")
    print(f"Temperature range: {df['current_temp'].min():.1f} - {df['current_temp'].max():.1f}°C")
    print(f"O2 range: {df['next_excess_o2'].min():.1f} - {df['next_excess_o2'].max():.1f}")
    print(f"Zero O2 occurrences: {(df['next_excess_o2'] == 0).sum()} out of {len(df)}")
    
    # Compare with real plant data ranges
    print(f"\nComparison with real plant data:")
    print(f"Real plant fuel flow: 516-627 vs Generated: {df['fuel_flow'].min():.0f}-{df['fuel_flow'].max():.0f}")
    print(f"Real plant AFR: 10.25-11.72 vs Generated: {df['air_fuel_ratio'].min():.2f}-{df['air_fuel_ratio'].max():.2f}")
    print(f"Real plant temp: 286-296°C vs Generated: {df['current_temp'].min():.0f}-{df['current_temp'].max():.0f}°C")
