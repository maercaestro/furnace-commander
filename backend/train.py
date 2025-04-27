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



# 3. Dataset + DataLoader
class FurnaceDataset(Dataset):
    def __init__(self, sequences):
        self.seq = sequences
    def __len__(self):
        return len(self.seq)
    def __getitem__(self, i):
        u, y = self.seq[i]
        return torch.from_numpy(u), torch.from_numpy(y)

ds = FurnaceDataset(sequences)
loader = DataLoader(ds, batch_size=64, shuffle=True, drop_last=True)

# after: loader = DataLoader(…)
for u_batch, y_batch in loader:
    # compute per-feature mean/std over (batch, timestep)
    u_mean = u_batch.mean(dim=(0,1))
    u_std  = u_batch.std(dim=(0,1))
    y_mean = y_batch.mean(dim=(0,1))
    y_std  = y_batch.std(dim=(0,1))
    print(">> u mean:", u_mean)
    print(">> u std: ", u_std)
    print(">> y mean:", y_mean)
    print(">> y std: ", y_std)
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

# 5. Training setup
device   = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model    = LiquidNN(in_dim=5, hid_dim=64, out_dim=2).to(device)
criterion= nn.MSELoss()
opt      = torch.optim.Adam(model.parameters(), lr=5e-4)
epochs   = 1000

for epoch in range(1, epochs+1):
    # --- training pass ---
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

    # --- validation pass ---
    model.eval()
    val_loss = 0.0
    with torch.no_grad():
        for u_batch, y_batch in val_loader:
            u_batch, y_batch = u_batch.to(device), y_batch.to(device)
            preds = model(u_batch)
            loss  = criterion(preds, y_batch)
            val_loss += loss.item() * u_batch.size(0)
    val_loss /= n_val

    print(f"Epoch {epoch:02d}/{epochs}  "
          f"- Train Loss: {train_loss:.4f}  "
          f"- Val Loss: {val_loss:.4f}")

# 7. Save the model

model.eval()
scripted = torch.jit.script(model.cpu())
scripted.save("lnn_model.ts")    # saves to lnn_model.ts

# 8. export to ONNX

# Create a dummy input tensor with the same shape as your model expects
dummy_input = torch.randn(1, 30, 5)  # Batch size 1, sequence length 30, 5 input features

# Export to TorchScript (your existing code)
scripted = torch.jit.script(model.cpu())
scripted.save("lnn_model.ts")

# Export to ONNX
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

