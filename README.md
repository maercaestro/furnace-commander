# Furnace Commander

An interactive furnace simulation game and AI control demonstration that teaches combustion optimization principles through engaging gameplay and showcases the power of machine learning in industrial control systems.

![Furnace Commander](/src/assets/logo_fc.png)

## Features

### Furnace Simulation Game
- **Real-time Temperature Control**: Adjust fuel flow to reach target temperature
- **Air/Fuel Ratio Management**: Find the optimal ratio for efficient combustion
- **Dynamic Inflow Conditions**: Deal with varying inlet temperatures and flow rates
- **Performance Metrics**: Track cost savings, emissions, and time efficiency
- **Scoring System**: Receive grades based on your furnace management skills
- **Leaderboard**: Compare your scores with other players

### AI Control Demonstration
- **LiquidNN Neural Network**: Watch a trained neural network control the furnace autonomously
- **Dynamic Challenges**: The AI tackles varying inlet conditions to maintain optimal performance
- **Live Performance Monitoring**: Visualize temperature curves, O₂ levels, and control decisions
- **Comparative Analysis**: See how AI control compares to manual operation
- **Explainable Results**: Understand the scoring and grading system

## Technology Stack

### Frontend
- **React**: Component-based UI architecture
- **Tailwind CSS**: Utility-first styling framework
- **Chart.js**: Real-time data visualization
- **React Router**: Navigation between game, leaderboard, and AI demo
- **ONNX Runtime Web**: In-browser neural network inference
- **Supabase**: Backend as a service for leaderboard functionality

### Backend
- **Python**: Backend processing and data generation
- **PyTorch**: Machine learning model training
- **NumPy/Pandas**: Data handling for simulation and model training
- **ONNX**: Model export format for cross-platform compatibility

## Getting Started

### Prerequisites
- Node.js (v14+)
- Python 3.8+ (for model training)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/maecaestro/furnace-commander.git
cd furnace-commander
```

2. Install frontend dependencies:
```bash
npm install
```

3. Set up the Python environment (for model training):
```bash
cd backend
pip install -r requirements.txt
```

4. Configure Supabase:
   - Create a `.env` file in the project root
   - Add your Supabase URL and anon key:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Generate synthetic data for model training:
```bash
python data.py
```

6. Train the LiquidNN model:
```bash
python train.py
```

7. Start the development server:
```bash
cd ..
npm run dev
```

### Building for Production

```bash
npm run build
```

## Project Structure

```
furnace-commander/
├── public/
│   ├── models/         # ONNX model files for AI demo
│   └── vite.svg        # Vite logo
├── src/
│   ├── components/     # React components
│   │   ├── AIControlDemo.jsx    # AI control demonstration
│   │   └── Leaderboard.jsx      # Leaderboard display
│   ├── utils/          # Utility functions
│   │   └── modelUtils.js        # Neural network related utilities
│   ├── assets/         # Images and other assets
│   ├── App.jsx         # Main application component
│   ├── main.jsx        # Application entry point
│   └── supabaseClient.js # Supabase configuration
├── backend/
│   ├── data.py         # Synthetic data generation
│   ├── train.py        # Neural network training
│   ├── lnn_model.ts    # Saved TorchScript model
│   ├── data/           # Dataset storage
│   └── models/         # Trained model storage
└── ...
```

## The Science Behind the Simulation

Furnace Commander simulates key aspects of industrial combustion systems:

1. **Combustion Efficiency**: Finding the optimal air/fuel ratio (around 14.7:1) for complete combustion
2. **Excess O₂ Management**: Maintaining optimal excess O₂ levels (1.5-2.5%) for efficiency and emissions control 
3. **Heat Transfer Dynamics**: Simulating temperature changes based on fuel input and heat losses
4. **Emissions Formation**: CO production increases exponentially when insufficient oxygen is available

The LiquidNN neural network used in the AI demonstration is a recurrent neural network architecture that combines:
- Continuous-time dynamics for fluid, temporal behavior
- Input normalization for stable training
- Sequence prediction for effective control decisions

## License

This project is licensed under the MIT License.
