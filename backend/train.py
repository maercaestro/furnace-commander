import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
import pandas as pd
import numpy as np
import os

# 1. Set up paths correctly
script_dir = os.path.dirname(os.path.abspath(__file__))  # Get directory of this script
data_dir = os.path.join(script_dir, 'data')  # Data directory inside backend folder
data_file = os.path.join(data_dir, 'synthetic_temperature_data.csv')

# Check if file exists and print helpful message
if not os.path.exists(data_file):
    print(f"Error: Input file not found at: {data_file}")
    print("Current directory:", os.getcwd())
    print("Available files in data directory:")
    if os.path.exists(data_dir):
        print([f for f in os.listdir(data_dir) if f.endswith('.csv')])
    else:
        print(f"Data directory not found: {data_dir}")
    raise FileNotFoundError(f"Could not find input file: {data_file}")

# Now load the data with the correct path
print(f"Loading data from: {data_file}")
df = pd.read_csv(data_file)

input_cols  = ['fuel_flow', 'air_fuel_ratio', 'current_temp', 'inflow_temp', 'inflow_rate']
target_cols = ['next_temp',   'next_excess_o2']

# ── 2) Compute global means & stds from the raw DataFrame
input_means  = df[input_cols].mean().to_numpy(dtype=np.float32)   # shape (5,)
input_stds   = df[input_cols].std().to_numpy(dtype=np.float32)    # shape (5,)
target_means = df[target_cols].mean().to_numpy(dtype=np.float32)  # shape (2,)
target_stds  = df[target_cols].std().to_numpy(dtype=np.float32)   # shape (2,)

print("Input means:",  input_means,  "\nInput stds:",  input_stds)
print("Target means:", target_means, "\nTarget stds:", target_stds)

# ── 3) When you build your sequences, apply scaling immediately:
sequences = []
for seq_id, group in df.groupby('sequence'):
    group = group.sort_values('timestep')
    # raw arrays
    u_raw = group[input_cols].to_numpy(dtype=np.float32)
    y_raw = group[target_cols].to_numpy(dtype=np.float32)
    # normalized
    u = (u_raw - input_means[None, :]) / input_stds[None, :]
    y = (y_raw - target_means[None, :]) / target_stds[None, :]
    sequences.append((u, y))

class FurnaceDataset(Dataset):
    def __init__(self, sequences):
        super().__init__()
        self.sequences = sequences

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        u, y = self.sequences[idx]
        # already numpy float32 → torch tensors
        return torch.from_numpy(u), torch.from_numpy(y)

# ── 2) Build dataset & split
dataset = FurnaceDataset(sequences)
n_total = len(dataset)
n_val   = int(0.2 * n_total)
n_train = n_total - n_val

train_ds, val_ds = random_split(
    dataset,
    [n_train, n_val],
    generator=torch.Generator().manual_seed(42)
)

# ── 3) Create DataLoaders
train_loader = DataLoader(train_ds, batch_size=64, shuffle=True,  drop_last=True)
val_loader   = DataLoader(val_ds,   batch_size=64, shuffle=False, drop_last=False)

# Quick data sanity check
print(f"Dataset loaded: {len(sequences)} sequences")
print(f"Train/Val split: {n_train}/{n_val} sequences")
for u_batch, y_batch in train_loader:
    print(f"Batch shapes: Input {u_batch.shape}, Target {y_batch.shape}")
    print(f"Input ranges: {u_batch.min():.3f} to {u_batch.max():.3f}")
    print(f"Target ranges: {y_batch.min():.3f} to {y_batch.max():.3f}")
    break



# 4. Liquid‐Cell and LiquidNN definitions
class LiquidCell(nn.Module):
    def __init__(self, in_dim, hid_dim):
        super().__init__()
        self.theta = nn.Parameter(torch.randn(hid_dim))
        self.fc = nn.Linear(in_dim + hid_dim, hid_dim)
    def forward(self, x, u):
        inp = torch.cat([x, u], dim=-1)
        dx = -self.theta * x + torch.tanh(self.fc(inp))
        dt = 0.1
        return x + dt*dx  # Δt = 1

class LiquidNN(nn.Module):
    def __init__(self, in_dim, hid_dim, out_dim):
        super().__init__()
        self.cell = LiquidCell(in_dim, hid_dim)
        self.readout = nn.Linear(hid_dim, out_dim)
    def forward(self, u_seq):
        batch, T, _ = u_seq.size()
        x = torch.zeros(batch, self.cell.theta.numel(), device=u_seq.device)
        outs = []
        for t in range(T):
            x = self.cell(x, u_seq[:, t, :])
            outs.append(self.readout(x))
        return torch.stack(outs, dim=1)

# 5. Training setup with convergence monitoring
device   = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model    = LiquidNN(in_dim=5, hid_dim=64, out_dim=2).to(device)
criterion= nn.MSELoss()
opt      = torch.optim.Adam(model.parameters(), lr=5e-4)

# Training parameters
max_epochs = 2000
patience = 50  # Early stopping patience
min_delta = 1e-5  # Minimum improvement threshold
best_val_loss = float('inf')
patience_counter = 0
best_model_state = None

# Training history for analysis
train_losses = []
val_losses = []

print(f"Starting training on {device}")
print(f"Training samples: {n_train}, Validation samples: {n_val}")
print(f"Early stopping: patience={patience}, min_delta={min_delta}")
print("-" * 60)

for epoch in range(1, max_epochs + 1):
    # --- Training pass ---
    model.train()
    train_loss = 0.0
    for u_batch, y_batch in train_loader:
        u_batch, y_batch = u_batch.to(device), y_batch.to(device)
        preds = model(u_batch)
        loss  = criterion(preds, y_batch)
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        opt.step()
        train_loss += loss.item() * u_batch.size(0)
    train_loss /= n_train

    # --- Validation pass ---
    model.eval()
    val_loss = 0.0
    with torch.no_grad():
        for u_batch, y_batch in val_loader:
            u_batch, y_batch = u_batch.to(device), y_batch.to(device)
            preds = model(u_batch)
            loss  = criterion(preds, y_batch)
            val_loss += loss.item() * u_batch.size(0)
    val_loss /= n_val
    
    # Store losses for analysis
    train_losses.append(train_loss)
    val_losses.append(val_loss)
    
    # Print progress
    if epoch % 10 == 0 or epoch <= 10:
        print(f"Epoch {epoch:4d}/{max_epochs}  "
              f"Train Loss: {train_loss:.6f}  "
              f"Val Loss: {val_loss:.6f}  "
              f"Best: {best_val_loss:.6f}")
    
    # Early stopping logic
    if val_loss < best_val_loss - min_delta:
        best_val_loss = val_loss
        patience_counter = 0
        # Save best model state
        best_model_state = model.state_dict().copy()
        if epoch % 10 != 0 and epoch > 10:
            print(f"Epoch {epoch:4d}/{max_epochs}  "
                  f"Train Loss: {train_loss:.6f}  "
                  f"Val Loss: {val_loss:.6f}  "
                  f"*** NEW BEST ***")
    else:
        patience_counter += 1
    
    # Check for convergence
    if patience_counter >= patience:
        print(f"\nEarly stopping at epoch {epoch}")
        print(f"Best validation loss: {best_val_loss:.6f}")
        print(f"No improvement for {patience} epochs")
        break

# Restore best model
if best_model_state is not None:
    model.load_state_dict(best_model_state)
    print(f"\nRestored best model with validation loss: {best_val_loss:.6f}")

# Training summary
print("\n" + "="*60)
print("TRAINING SUMMARY")
print("="*60)
print(f"Total epochs: {epoch}")
print(f"Best validation loss: {best_val_loss:.6f}")
print(f"Final train loss: {train_losses[-1]:.6f}")
print(f"Final val loss: {val_losses[-1]:.6f}")

# Check for overfitting
if len(train_losses) > 50:
    recent_train = np.mean(train_losses[-10:])
    recent_val = np.mean(val_losses[-10:])
    overfitting_ratio = recent_val / recent_train
    print(f"Overfitting check (val/train ratio): {overfitting_ratio:.3f}")
    if overfitting_ratio > 1.5:
        print("⚠️  WARNING: Possible overfitting detected!")
    elif overfitting_ratio < 1.1:
        print("✅ Good generalization")
    else:
        print("📊 Moderate generalization")

# Convergence analysis
if len(val_losses) > 20:
    last_20_std = np.std(val_losses[-20:])
    print(f"Validation stability (last 20 epochs std): {last_20_std:.6f}")
    if last_20_std < 0.001:
        print("✅ Model converged (stable validation loss)")
    else:
        print("⚠️  Model may need more training or different hyperparameters")

# 7. Save the model with metadata
print("\n" + "="*60)
print("SAVING MODEL")
print("="*60)

model.eval()

# Save training metadata
converged = len(val_losses) > 20 and np.std(val_losses[-20:]) < 0.001
metadata = {
    'final_epoch': int(epoch),
    'best_val_loss': float(best_val_loss),
    'final_train_loss': float(train_losses[-1]),
    'final_val_loss': float(val_losses[-1]),
    'input_means': [float(x) for x in input_means],
    'input_stds': [float(x) for x in input_stds],
    'target_means': [float(x) for x in target_means],
    'target_stds': [float(x) for x in target_stds],
    'training_converged': bool(converged),
    'total_epochs_run': int(epoch),
    'patience_used': int(patience),
    'min_delta_used': float(min_delta)
}

# Save metadata to file
import json
metadata_path = os.path.join(os.path.dirname(__file__), "models", "training_metadata.json")
os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"Training metadata saved to: {metadata_path}")

# Save TorchScript model
scripted = torch.jit.script(model.cpu())
scripted.save("lnn_model.ts")
print("TorchScript model saved to: lnn_model.ts")

# 8. Export to ONNX
# Create a dummy input tensor with the same shape as your model expects
dummy_input = torch.randn(1, 30, 5)  # Batch size 1, sequence length 30, 5 input features

onnx_path = os.path.join(os.path.dirname(__file__), "models", "lnn_model.onnx")
os.makedirs(os.path.dirname(onnx_path), exist_ok=True)

torch.onnx.export(
    model,                    # model being run
    dummy_input,              # model input (or a tuple for multiple inputs)
    onnx_path,                # where to save the model
    export_params=True,       # store the trained parameter weights inside the model file
    opset_version=12,         # the ONNX version to export the model to
    do_constant_folding=True, # whether to execute constant folding optimization
    input_names=['input'],    # the model's input names
    output_names=['output'],  # the model's output names
    dynamic_axes={
        'input': {0: 'batch_size', 1: 'sequence_length'},  # variable length axes
        'output': {0: 'batch_size', 1: 'sequence_length'}
    }
)
print(f"ONNX model saved to: {onnx_path}")

print(f"\n{'='*60}")
print("TRAINING COMPLETE!")
print(f"{'='*60}")
print(f"Best model achieved validation loss: {best_val_loss:.6f}")
print(f"Models saved:")
print(f"  - TorchScript: lnn_model.ts")
print(f"  - ONNX: {onnx_path}")
print(f"  - Metadata: {metadata_path}")
print(f"{'='*60}")

