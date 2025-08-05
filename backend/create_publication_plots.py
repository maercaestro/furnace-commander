import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os

# Set publication-ready style
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("husl")

def create_publication_plots():
    """Create clean, publication-ready plots of the benchmark data"""
    
    # Load the processed data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(script_dir, 'benchmark_data_with_timesteps.csv')
    
    if not os.path.exists(data_file):
        print("Error: Please run analyze_benchmark_data.py first to generate the processed data file.")
        return
    
    df = pd.read_csv(data_file)
    
    # Define better variable names for plotting
    var_names = {
        '12TI008': 'Furnace Temperature (°C)',
        '13FC004': 'Air Flow Rate (units/h)',
        '12TC005': 'Inlet Temperature (°C)', 
        '12XZA002': 'Oxygen Analyzer (%)',
        '12FC028': 'Fuel Flow Rate (units/h)',
        '12QI003': 'Excess O₂ (%)',
        '58QI001': 'Emissions (ppm)'
    }
    
    numeric_columns = ['12TI008', '13FC004', '12TC005', '12XZA002', '12FC028', '12QI003', '58QI001']
    
    # Create a comprehensive 2x4 subplot layout
    fig, axes = plt.subplots(2, 4, figsize=(20, 10))
    fig.suptitle('Industrial Furnace Process Variables - Benchmark Data Analysis', 
                 fontsize=16, fontweight='bold', y=0.98)
    
    # Flatten axes for easier iteration
    axes = axes.flatten()
    
    for i, var in enumerate(numeric_columns):
        ax = axes[i]
        
        # Create time series plot
        ax.plot(df['timestep'], df[var], linewidth=0.5, alpha=0.7, color='steelblue')
        
        # Add moving average for cleaner trend
        window = max(100, len(df) // 1000)  # Adaptive window size
        ma = df[var].rolling(window=window, center=True).mean()
        ax.plot(df['timestep'], ma, linewidth=2, color='red', alpha=0.8, 
                label=f'Moving Average (n={window})')
        
        ax.set_xlabel('Timestep (minutes)')
        ax.set_ylabel(var_names.get(var, var))
        ax.set_title(f'{var_names.get(var, var)}')
        ax.grid(True, alpha=0.3)
        ax.legend(fontsize=8)
        
        # Add statistics text box
        stats_text = f'Mean: {df[var].mean():.2f}\nStd: {df[var].std():.2f}'
        ax.text(0.02, 0.98, stats_text, transform=ax.transAxes, 
                verticalalignment='top', bbox=dict(boxstyle="round,pad=0.3", 
                facecolor="white", alpha=0.8), fontsize=8)
    
    # Hide the last empty subplot
    axes[-1].set_visible(False)
    
    plt.tight_layout()
    
    # Save publication-ready plot
    pub_path = os.path.join(script_dir, 'benchmark_data_publication_ready.png')
    plt.savefig(pub_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"Publication-ready plot saved to: {pub_path}")
    
    # Create correlation analysis plot
    plt.figure(figsize=(12, 8))
    
    # Calculate correlation matrix
    corr_data = df[numeric_columns].corr()
    
    # Create a mask for the upper triangle
    mask = np.triu(np.ones_like(corr_data, dtype=bool))
    
    # Create heatmap
    sns.heatmap(corr_data, mask=mask, annot=True, cmap='RdBu_r', center=0,
                square=True, linewidths=0.5, cbar_kws={"shrink": .8},
                xticklabels=[var_names.get(col, col) for col in corr_data.columns],
                yticklabels=[var_names.get(col, col) for col in corr_data.columns])
    
    plt.title('Process Variable Correlation Matrix', fontsize=14, fontweight='bold')
    plt.xticks(rotation=45, ha='right')
    plt.yticks(rotation=0)
    plt.tight_layout()
    
    corr_path = os.path.join(script_dir, 'benchmark_correlation_publication.png')
    plt.savefig(corr_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"Correlation matrix saved to: {corr_path}")
    
    # Create a focused comparison plot for key variables
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
    fig.suptitle('Key Process Variables Comparison', fontsize=16, fontweight='bold')
    
    # Temperature vs Time
    ax1.plot(df['timestep'], df['12TI008'], linewidth=0.8, color='red', alpha=0.8)
    ax1.set_ylabel('Furnace Temperature (°C)')
    ax1.set_title('Furnace Temperature Control')
    ax1.grid(True, alpha=0.3)
    
    # Flow rates vs Time  
    ax2.plot(df['timestep'], df['13FC004'], linewidth=0.8, label='Air Flow', alpha=0.8)
    ax2.plot(df['timestep'], df['12FC028']/3, linewidth=0.8, label='Fuel Flow (÷3)', alpha=0.8)  # Scale for visibility
    ax2.set_ylabel('Flow Rate (units/h)')
    ax2.set_title('Air and Fuel Flow Rates')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    # Oxygen measurements vs Time
    ax3.plot(df['timestep'], df['12XZA002'], linewidth=0.8, label='O₂ Analyzer', alpha=0.8)
    ax3.plot(df['timestep'], df['12QI003'], linewidth=0.8, label='Excess O₂', alpha=0.8)
    ax3.set_ylabel('Oxygen Content (%)')
    ax3.set_xlabel('Timestep (minutes)')
    ax3.set_title('Oxygen Measurements')
    ax3.legend()
    ax3.grid(True, alpha=0.3)
    
    # Emissions vs Time
    ax4.plot(df['timestep'], df['58QI001'], linewidth=0.8, color='green', alpha=0.8)
    ax4.set_ylabel('Emissions (ppm)')
    ax4.set_xlabel('Timestep (minutes)')
    ax4.set_title('Emission Levels')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    comparison_path = os.path.join(script_dir, 'benchmark_key_variables_comparison.png')
    plt.savefig(comparison_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"Key variables comparison saved to: {comparison_path}")
    
    # Show plots
    plt.show()
    
    # Print summary insights
    print(f"\n{'='*60}")
    print("BENCHMARK DATA INSIGHTS")
    print(f"{'='*60}")
    
    # Temperature stability analysis
    temp_stability = df['12TI008'].std()
    print(f"🌡️  Temperature Stability: ±{temp_stability:.2f}°C (excellent control)")
    
    # Flow rate analysis
    air_flow_cv = (df['13FC004'].std() / df['13FC004'].mean()) * 100
    fuel_flow_cv = (df['12FC028'].std() / df['12FC028'].mean()) * 100
    print(f"💨 Air Flow Variability: {air_flow_cv:.1f}% CV")
    print(f"⛽ Fuel Flow Variability: {fuel_flow_cv:.1f}% CV")
    
    # Oxygen control analysis
    o2_control = df['12QI003'].std()
    print(f"🫁 O₂ Control Precision: ±{o2_control:.3f}% (very stable)")
    
    # Emissions analysis
    emissions_mean = df['58QI001'].mean()
    emissions_max = df['58QI001'].max()
    print(f"🏭 Emissions: {emissions_mean:.1f} ppm average, {emissions_max:.1f} ppm peak")
    
    # Correlation insights
    temp_fuel_corr = df['12TI008'].corr(df['12FC028'])
    o2_fuel_corr = df['12QI003'].corr(df['12FC028'])
    print(f"🔗 Temperature-Fuel correlation: {temp_fuel_corr:.3f}")
    print(f"🔗 O₂-Fuel correlation: {o2_fuel_corr:.3f}")
    
    print(f"\n✅ Publication-ready plots generated successfully!")
    print(f"📊 Data covers {len(df):,} timesteps ({len(df)/60/24:.1f} days)")

if __name__ == "__main__":
    create_publication_plots()
