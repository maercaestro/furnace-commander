import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os

# Set up the file path
script_dir = os.path.dirname(os.path.abspath(__file__))
data_file = os.path.join(script_dir, 'data', 'BenchmarkData2.xlsx')

print(f"Loading data from: {data_file}")

try:
    # Load the Excel file
    df = pd.read_excel(data_file)
    print(f"Data loaded successfully!")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"\nFirst few rows:")
    print(df.head())
    print(f"\nData info:")
    print(df.info())
    
    # Convert Date column to datetime if it exists
    if 'Date' in df.columns:
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    
    # Convert all non-date columns to numeric, handling errors
    feature_columns = [col for col in df.columns if col != 'Date']
    for col in feature_columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Drop rows with all NaN values
    df = df.dropna(how='all')
    
    print(f"\nAfter data cleaning:")
    print(f"Shape: {df.shape}")
    print(f"Data info:")
    print(df.info())
    print(f"\nData description:")
    print(df.describe())
    
    # Create timestep column (replace date with sequential timesteps)
    df['timestep'] = range(len(df))
    
    # Identify all numeric columns (excluding timestep and Date)
    numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
    if 'timestep' in numeric_columns:
        numeric_columns.remove('timestep')
    
    # Remove Date if it's still in numeric columns (shouldn't be after conversion)
    if 'Date' in numeric_columns:
        numeric_columns.remove('Date')
    
    print(f"\nNumeric columns to plot: {numeric_columns}")
    
    # Set up the plotting style
    plt.style.use('default')
    sns.set_palette("husl")
    
    # Calculate subplot grid dimensions
    n_features = len(numeric_columns)
    n_cols = 3  # 3 columns
    n_rows = (n_features + n_cols - 1) // n_cols  # Ceiling division
    
    # Create subplots for all features
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 4*n_rows))
    fig.suptitle('Benchmark Data Analysis - All Features vs Timestep', fontsize=16, fontweight='bold')
    
    # Flatten axes array for easier indexing
    if n_rows == 1:
        axes = [axes] if n_cols == 1 else axes
    else:
        axes = axes.flatten()
    
    # Plot each feature
    for i, feature in enumerate(numeric_columns):
        ax = axes[i]
        
        # Plot the feature vs timestep
        ax.plot(df['timestep'], df[feature], linewidth=1.5, alpha=0.8)
        ax.set_xlabel('Timestep')
        ax.set_ylabel(feature)
        ax.set_title(f'{feature} vs Timestep')
        ax.grid(True, alpha=0.3)
        
        # Add statistics to the plot
        mean_val = df[feature].mean()
        std_val = df[feature].std()
        ax.axhline(y=mean_val, color='red', linestyle='--', alpha=0.7, 
                   label=f'Mean: {mean_val:.2f}')
        ax.fill_between(df['timestep'], mean_val - std_val, mean_val + std_val, 
                        alpha=0.2, color='red', label=f'±1σ: {std_val:.2f}')
        ax.legend(fontsize=8)
    
    # Hide empty subplots
    for i in range(n_features, len(axes)):
        axes[i].set_visible(False)
    
    plt.tight_layout()
    
    # Save the comprehensive plot
    output_path = os.path.join(script_dir, 'benchmark_data_analysis.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\nComprehensive plot saved to: {output_path}")
    
    # Create individual detailed plots for each feature
    for feature in numeric_columns:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        fig.suptitle(f'Detailed Analysis: {feature}', fontsize=14, fontweight='bold')
        
        # Time series plot
        ax1.plot(df['timestep'], df[feature], linewidth=2, alpha=0.8, color='steelblue')
        ax1.set_xlabel('Timestep')
        ax1.set_ylabel(feature)
        ax1.set_title(f'{feature} Time Series')
        ax1.grid(True, alpha=0.3)
        
        # Add trend line
        z = np.polyfit(df['timestep'], df[feature], 1)
        p = np.poly1d(z)
        ax1.plot(df['timestep'], p(df['timestep']), "r--", alpha=0.8, 
                 label=f'Trend: {z[0]:.4f}x + {z[1]:.2f}')
        ax1.legend()
        
        # Distribution plot
        ax2.hist(df[feature], bins=30, alpha=0.7, color='lightcoral', edgecolor='black')
        ax2.axvline(df[feature].mean(), color='red', linestyle='--', linewidth=2, 
                    label=f'Mean: {df[feature].mean():.2f}')
        ax2.axvline(df[feature].median(), color='green', linestyle='--', linewidth=2, 
                    label=f'Median: {df[feature].median():.2f}')
        ax2.set_xlabel(feature)
        ax2.set_ylabel('Frequency')
        ax2.set_title(f'{feature} Distribution')
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        plt.tight_layout()
        
        # Save individual plot
        individual_path = os.path.join(script_dir, f'benchmark_{feature.lower().replace(" ", "_")}_analysis.png')
        plt.savefig(individual_path, dpi=300, bbox_inches='tight')
        print(f"Individual plot for {feature} saved to: {individual_path}")
    
    # Create correlation heatmap
    if len(numeric_columns) > 1:
        plt.figure(figsize=(12, 10))
        correlation_matrix = df[numeric_columns].corr()
        
        # Create heatmap
        mask = np.triu(np.ones_like(correlation_matrix, dtype=bool))
        sns.heatmap(correlation_matrix, mask=mask, annot=True, cmap='coolwarm', 
                   center=0, square=True, linewidths=0.5, cbar_kws={"shrink": .5})
        plt.title('Feature Correlation Matrix', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        correlation_path = os.path.join(script_dir, 'benchmark_correlation_matrix.png')
        plt.savefig(correlation_path, dpi=300, bbox_inches='tight')
        print(f"Correlation matrix saved to: {correlation_path}")
    
    # Create summary statistics table
    summary_stats = df[numeric_columns].describe()
    print(f"\n{'='*60}")
    print("SUMMARY STATISTICS")
    print(f"{'='*60}")
    print(summary_stats)
    
    # Save summary statistics to CSV
    stats_path = os.path.join(script_dir, 'benchmark_summary_statistics.csv')
    summary_stats.to_csv(stats_path)
    print(f"\nSummary statistics saved to: {stats_path}")
    
    # Create data with timesteps and save
    df_with_timesteps = df.copy()
    timestep_data_path = os.path.join(script_dir, 'benchmark_data_with_timesteps.csv')
    df_with_timesteps.to_csv(timestep_data_path, index=False)
    print(f"Data with timesteps saved to: {timestep_data_path}")
    
    # Show all plots
    plt.show()
    
    print(f"\n{'='*60}")
    print("ANALYSIS COMPLETE!")
    print(f"{'='*60}")
    print(f"✅ Loaded {len(df)} data points with {len(numeric_columns)} features")
    print(f"✅ Generated comprehensive visualization")
    print(f"✅ Created individual feature analysis plots")
    print(f"✅ Generated correlation matrix")
    print(f"✅ Exported summary statistics")
    print(f"✅ Saved processed data with timesteps")

except FileNotFoundError:
    print(f"Error: Could not find the file {data_file}")
    print("Please make sure the BenchmarkData2.xlsx file exists in the backend/data/ directory")
except Exception as e:
    print(f"Error loading or processing data: {e}")
    import traceback
    traceback.print_exc()
