import numpy as np
import pandas as pd
import os

script_dir = os.path.dirname(__file__)
data_dir = os.path.join(script_dir, 'data')

os.makedirs(data_dir, exist_ok=True)
data_path = os.path.join(data_dir, 'synthetic_temperature_data.csv')

def calculate_temperature(fuel_flow, air_flow, current_temp, inflow_temp, inflow_rate, noise_level=1.0):
    # Convert rates to SI per second (units/hour to units/second)
    fuel_s = fuel_flow / 3600.0
    inflow_s = inflow_rate / 3600.0
    
    # Constants
    AFR_opt = 14.7
    max_fuel_energy = 39000.0       # kJ per Nm³
    furnace_mass = 5000.0           # kg
    specific_heat = 0.5             # kJ/(kg·°C)
    heat_loss_coeff = 0.0005        # kJ/(°C·s)
    inlet_coeff = 0.0002            # kJ/(unit·°C·s)
    ambient_temp = 25.0             # °C
    time_step = 1.0                 # second
    
    # Combustion efficiency (Gaussian)
    AFR = air_flow / max(fuel_flow, 1e-3)
    efficiency = np.exp(- (AFR - AFR_opt)**2 / (2 * 2.0**2))
    
    # Heat terms
    Q_comb = fuel_s * max_fuel_energy * efficiency * time_step
    Q_loss = heat_loss_coeff * (current_temp - ambient_temp) * time_step
    Q_inflow = inlet_coeff * inflow_s * (current_temp - inflow_temp) * time_step
    
    # Net energy and temperature change
    net_energy = Q_comb - Q_loss - Q_inflow
    temp_change = net_energy / (furnace_mass * specific_heat)
    
    # Add random noise
    noise = (np.random.rand() - 0.5) * 2 * noise_level
    new_temp = current_temp + temp_change + noise
    
    return max(ambient_temp, new_temp)

def calculate_excess_o2(air_fuel_ratio, fuel_flow, current_temp, noise_level=0.2):
    # Convert fuel flow to Nm³/s
    fuel_s = fuel_flow / 3600.0
    
    # Constants
    HHV = 39000.0    # kJ per Nm³
    U = 0.0005       # kJ/(s·m²·°C)
    A = 10.0         # m²
    T_flame = 1800.0 # °C
    AFR_opt = 14.7
    sigma = 2.0
    
    # Efficiency (Gaussian)
    eta = np.exp(- (air_fuel_ratio - AFR_opt)**2 / (2 * sigma**2))
    
    # Heat rates
    Q_comb  = fuel_s * HHV * eta
    Q_trans = U * A * (T_flame - current_temp)
    
    # Fraction lost → O₂
    frac_lost = max(0, 1 - Q_trans / max(Q_comb, 1e-6))
    excess_o2 = frac_lost * 21.0
    
    # Add small noise
    noise = (np.random.rand() - 0.5) * 2 * noise_level
    return max(0, excess_o2 + noise)

# 2. Sampling parameters
num_sequences = 10000
sequence_length = 30

ranges = {
    'fuel_flow':      (1.0, 20.0),
    'air_fuel_ratio': (0.6, 25.0),
    'current_temp':   (25.0, 500.0),
    'inflow_temp':    (100.0, 200.0),
    'inflow_rate':    (50.0, 200.0)
}

# 3. Generate synthetic time-series data
records = []
for seq in range(num_sequences):
    fuel_flow     = np.random.uniform(*ranges['fuel_flow'])
    afr           = np.random.uniform(*ranges['air_fuel_ratio'])
    current_temp  = np.random.uniform(*ranges['current_temp'])
    inflow_temp   = np.random.uniform(*ranges['inflow_temp'])
    inflow_rate   = np.random.uniform(*ranges['inflow_rate'])
    air_flow      = fuel_flow * afr
    
    for t in range(sequence_length):
        next_temp = calculate_temperature(
            fuel_flow, air_flow, current_temp, inflow_temp, inflow_rate
        )
        next_o2   = calculate_excess_o2(afr, fuel_flow, current_temp)
        
        records.append({
            'sequence':        seq,
            'timestep':        t,
            'fuel_flow':       fuel_flow,
            'air_fuel_ratio':  afr,
            'current_temp':    current_temp,
            'inflow_temp':     inflow_temp,
            'inflow_rate':     inflow_rate,
            'next_temp':       next_temp,
            'next_excess_o2':  next_o2
        })
        
        # Update for next step
        current_temp = next_temp
        inflow_temp  = np.clip(inflow_temp + (np.random.rand() - 0.5) * 10, 
                               *ranges['inflow_temp'])
        inflow_rate  = np.clip(inflow_rate + (np.random.rand() - 0.5) * 20, 
                               *ranges['inflow_rate'])

# Convert to DataFrame and save
df = pd.DataFrame(records)
df.to_csv(data_path, index=False)

