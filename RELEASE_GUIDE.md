# Release Guide for Furnace Commander v1.0.0

This guide will help you create a GitHub release and obtain a DOI through Zenodo.

## Pre-Release Checklist

- [x] CITATION.cff file created
- [x] CHANGELOG.md with version history
- [x] requirements.txt for Python dependencies
- [x] package.json updated with version 1.0.0
- [x] MIT License in place
- [x] README.md comprehensive documentation
- [ ] All code committed to main branch
- [ ] All tests passing (if applicable)
- [ ] Documentation reviewed

## Files Prepared for Release

### 1. CITATION.cff
Standard citation file format for research software. Contains:
- Software metadata (title, abstract, authors)
- Version 1.0.0
- Release date
- Keywords for discoverability
- Repository URL

### 2. CHANGELOG.md
Complete version history following Keep a Changelog format.

### 3. requirements.txt
Python dependencies for the backend/model training.

### 4. package.json
Updated with:
- Version: 1.0.0
- Repository information
- Keywords for npm/GitHub
- Author information
- Changed to public (private: false)

## Steps to Create GitHub Release

### 1. Commit All Changes
```bash
git add .
git commit -m "Prepare v1.0.0 release - Add CITATION.cff, CHANGELOG, requirements.txt"
git push origin main
```

### 2. Create GitHub Release
1. Go to your repository on GitHub
2. Click "Releases" in the right sidebar
3. Click "Create a new release"
4. Fill in the release form:
   - **Tag version**: `v1.0.0`
   - **Release title**: `Furnace Commander v1.0.0 - Initial Release`
   - **Description**: Copy from CHANGELOG.md or use this template:

```markdown
# Furnace Commander v1.0.0

The first official release of Furnace Commander - an interactive furnace simulation game and AI control demonstration.

## Highlights

🎮 **Interactive Game Mode**
- Real-time temperature control and fuel flow management
- Dynamic air/fuel ratio optimization
- Performance scoring and leaderboard

🤖 **AI Control Demonstration**
- LiquidNN neural network for autonomous control
- Live performance monitoring and visualization
- Comparative analysis with manual control

🔬 **Research-Ready**
- ONNX model export for cross-platform inference
- Synthetic data generation pipeline
- Comprehensive benchmark analysis

## Features
- Real-time temperature control with dynamic inflow conditions
- Air/fuel ratio management (~14.7:1 optimal)
- Excess O₂ management (1.5-2.5% target)
- Performance metrics: cost savings, emissions, efficiency
- Scoring system with letter grades (A+ to F)
- Online leaderboard via Supabase
- AI demo with trained LiquidNN model

## Tech Stack
- **Frontend**: React, Tailwind CSS, Chart.js, ONNX Runtime Web
- **Backend**: Python, PyTorch, NumPy, Pandas
- **ML Model**: LiquidNN recurrent neural network

## Installation

See [README.md](README.md) for complete installation and setup instructions.

## Citation

If you use this software in your research, please cite:

```bibtex
@software{Bin_Haji_Bidin_Furnace_Commander_2025,
  author = {Bin Haji Bidin, Abu Huzaifah},
  title = {Furnace Commander: Interactive Combustion Optimization Game and AI Control Demonstration},
  version = {1.0.0},
  year = {2025},
  url = {https://github.com/maercaestro/furnace-commander}
}
```

Or use the CITATION.cff file in this repository.

## License

MIT License - See LICENSE file for details.
```

5. Check "Set as the latest release"
6. Click "Publish release"

## Steps to Get a DOI via Zenodo

### 1. Link GitHub to Zenodo
1. Go to [Zenodo.org](https://zenodo.org/) and log in with your GitHub account
2. Go to https://zenodo.org/account/settings/github/
3. Find your "furnace-commander" repository
4. Toggle the switch to ON to enable Zenodo integration

### 2. Create a New Release (if not done already)
Once Zenodo is connected, any new GitHub release will automatically:
- Be archived on Zenodo
- Receive a DOI
- Be permanently preserved

### 3. Access Your DOI
1. After creating the GitHub release, go to your Zenodo account
2. Click "Upload" → "GitHub"
3. Find your furnace-commander repository
4. Copy the DOI badge and add it to your README

### 4. Update README with DOI Badge
Add to the top of your README.md:

```markdown
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXX)
```

Replace XXXXXXX with your actual DOI number from Zenodo.

## Recommended Zenodo Metadata

When your repository is first uploaded to Zenodo, you may want to edit the metadata:

- **Upload type**: Software
- **Publication date**: 2025-12-23
- **Title**: Furnace Commander: Interactive Combustion Optimization Game and AI Control Demonstration
- **Authors**: Abu Huzaifah Bin Haji Bidin
- **Description**: Copy from README abstract
- **License**: MIT License
- **Keywords**: combustion optimization, machine learning, neural networks, LiquidNN, industrial control, simulation game, educational software, ONNX, PyTorch, React
- **Related identifiers**: Link to GitHub repository

## Post-Release Tasks

1. Add DOI badge to README.md
2. Update CITATION.cff with DOI information
3. Announce the release on relevant platforms
4. Consider submitting to JOSS (Journal of Open Source Software) if applicable

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Next releases:
- Bug fixes → v1.0.1, v1.0.2, etc.
- New features → v1.1.0, v1.2.0, etc.
- Breaking changes → v2.0.0, v3.0.0, etc.

## Questions?

If you need help with the release process, consult:
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Zenodo GitHub Guide](https://docs.github.com/en/repositories/archiving-a-github-repository/referencing-and-citing-content)
- [Making Your Code Citable](https://guides.github.com/activities/citable-code/)
