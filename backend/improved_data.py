import numpy as np
import pandas as pd
import os

def calculate_temperature(fuel_flow, air_flow, current_temp, inflow_temp, inflow_rate, noise_level=0.5):
    """Improved temperature calculation with realistic physics"""
    fuel_s = fuel_flow / 3600.0
    inflow_s = inflow_rate / 3600.0
    
    # Constants (same as game)
    AFR_opt = 14.7
    max_fuel_energy = 39000.0
    furnace_mass = 5000.0
    specific_heat = 0.5
    heat_loss_coeff = 0.0005
    inlet_coeff = 0.0002
    ambient_temp = 25.0
    time_step = 1.0
    
    # Combustion efficiency with realistic constraints
    AFR = air_flow / max(fuel_flow, 1e-3)
    
    # Add penalties for extreme AFR values
    if AFR < 5.0:  # Too fuel-rich - incomplete combustion
        efficiency = 0.3 * np.exp(-(AFR - AFR_opt)**2 / (2 * 2.0**2))
    elif AFR > 25.0:  # Too lean - poor combustion
        efficiency = 0.5 * np.exp(-(AFR - AFR_opt)**2 / (2 * 2.0**2))
    else:  # Normal range
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
    """Improved O2 calculation with realistic physics"""
    fuel_s = fuel_flow / 3600.0
    
    # Constants (same as game)
    HHV = 39000.0
    U = 0.0005
    A = 10.0
    T_flame = 1800.0
    AFR_opt = 14.7
    sigma = 2.0
    
    # Realistic efficiency with constraints
    AFR = air_fuel_ratio
    if AFR < 5.0:  # Too fuel-rich
        eta = 0.2 * np.exp(-(AFR - AFR_opt)**2 / (2 * sigma**2))
    elif AFR > 25.0:  # Too lean
        eta = 0.4 * np.exp(-(AFR - AFR_opt)**2 / (2 * sigma**2))
    else:
        eta = np.exp(-(AFR - AFR_opt)**2 / (2 * sigma**2))
    
    Q_comb = fuel_s * HHV * eta
    Q_trans = U * A * (T_flame - current_temp)
    
    frac_lost = max(0, 1 - Q_trans / max(Q_comb, 1e-6))
    excess_o2 = frac_lost * 21.0
    
    # Ensure realistic O2 levels
    if AFR < 8.0:  # Very fuel-rich - low O2
        excess_o2 = min(excess_o2, 1.0)
    elif AFR > 20.0:  # Very lean - high O2
        excess_o2 = max(excess_o2, 5.0)
    
    # Realistic noise
    noise = (np.random.rand() - 0.5) * 2 * noise_level
    return max(0.0, excess_o2 + noise)

def generate_realistic_sequences(num_sequences=5000, sequence_length=30):
    """Generate more realistic training sequences with variable parameters"""
    
    # More realistic parameter ranges
    ranges = {
        'fuel_flow': (5.0, 15.0),      # Narrower, more realistic range
        'air_fuel_ratio': (10.0, 20.0), # Realistic combustion range
        'current_temp': (300.0, 500.0), # Typical operating range
        'inflow_temp': (100.0, 200.0),
        'inflow_rate': (75.0, 125.0)    # Narrower range
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
            
            # Allow parameters to change slightly during sequence (more realistic)
            if t % 5 == 0:  # Change every 5 steps
                fuel_flow += np.random.normal(0, 0.5)  # Small changes
                afr += np.random.normal(0, 0.2)
                fuel_flow = np.clip(fuel_flow, *ranges['fuel_flow'])
                afr = np.clip(afr, *ranges['air_fuel_ratio'])
                air_flow = fuel_flow * afr
            
            # Inflow conditions change gradually
            inflow_temp += np.random.normal(0, 2)
            inflow_rate += np.random.normal(0, 3)
            inflow_temp = np.clip(inflow_temp, *ranges['inflow_temp'])
            inflow_rate = np.clip(inflow_rate, *ranges['inflow_rate'])
    
    return pd.DataFrame(records)

if __name__ == "__main__":
    print("Generating improved training data...")
    df = generate_realistic_sequences()
    
    # Save data
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    output_path = os.path.join(data_dir, 'improved_training_data.csv')
    df.to_csv(output_path, index=False)
    
    print(f"Generated {len(df)} training samples")
    print(f"Saved to: {output_path}")
    
    # Print statistics
    print(f"\nData quality check:")
    print(f"Zero O2 occurrences: {(df['next_excess_o2'] == 0).sum()} out of {len(df)}")
    print(f"AFR range: {df['air_fuel_ratio'].min():.1f} - {df['air_fuel_ratio'].max():.1f}")
    print(f"O2 range: {df['next_excess_o2'].min():.1f} - {df['next_excess_o2'].max():.1f}")
