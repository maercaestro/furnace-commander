# Changelog

All notable changes to Furnace Commander will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-23

### Added
- Interactive furnace simulation game with real-time temperature control
- AI control demonstration using LiquidNN neural network
- Dynamic air/fuel ratio management system
- Performance metrics tracking (cost savings, emissions, time efficiency)
- Scoring and grading system for player performance
- Online leaderboard functionality using Supabase
- ONNX model export for cross-platform neural network inference
- Synthetic data generation for model training
- Comprehensive documentation and installation guide
- MIT License

### Features
#### Game Mode
- Real-time temperature control and fuel flow adjustment
- Variable inlet conditions (temperature and flow rate)
- Optimal air/fuel ratio discovery (~14.7:1)
- Excess O₂ management (1.5-2.5% target)
- Performance scoring system with letter grades

#### AI Demo Mode
- Autonomous furnace control using trained LiquidNN model
- Live performance monitoring and visualization
- Temperature curves and O₂ level tracking
- Comparative analysis with manual control

#### Technical Stack
- Frontend: React, Tailwind CSS, Chart.js, ONNX Runtime Web
- Backend: Python, PyTorch, NumPy, Pandas
- Database: Supabase for leaderboard
- Model: LiquidNN recurrent neural network architecture

### Research Outputs
- Benchmark data analysis and model performance evaluation
- Publication-ready plots and visualization tools
- Enhanced model versions with improved performance
- Comprehensive research documentation

[1.0.0]: https://github.com/maercaestro/furnace-commander/releases/tag/v1.0.0
