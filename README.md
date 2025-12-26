# COINjecture Oracle Monitor

Automated testing and monitoring bot for the [COINjecture Holographic Oracle](https://amoy.polygonscan.com/address/0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE) smart contract.

## 🚀 Features

- ✅ Comprehensive test suite with multiple scenarios
- ✅ Continuous monitoring with configurable intervals
- ✅ **Real-world market monitoring** (Binance, Polygon, etc.)
- ✅ **Live market data → Oracle parameters** (η, λ mapping)
- ✅ **Critical equilibrium detection** (Δ ≈ 231 alerts)
- ✅ Input validation testing
- ✅ Edge case coverage
- ✅ CI/CD integration (GitHub Actions)
- ✅ Docker support
- ✅ Systemd service support

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Access to Polygon Amoy RPC endpoint (or configure your own)

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/coinjecture/oracle-monitor.git
cd oracle-monitor

# Install dependencies
npm install
```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```bash
# Contract address (default: Polygon Amoy deployment)
ORACLE_ADDRESS=0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE

# RPC endpoint
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Monitoring interval (minutes)
MONITOR_INTERVAL_MINUTES=5
```

## 🧪 Usage

### Run Test Suite

```bash
# Standard test suite
npm test

# Real-world scenario testing (recommended)
npm run test:real

# With environment variables
npm run test:amoy
npm run test:real:amoy
```

### Start Monitoring

```bash
# Contract health monitoring
npm run monitor

# Real-world market monitoring (NEW!)
npm run monitor:btc    # Monitor Bitcoin
npm run monitor:eth    # Monitor Ethereum
npm run monitor:market SYMBOL SOURCE MODE  # Custom market
```

See [MARKET_MONITORING.md](./MARKET_MONITORING.md) for detailed market monitoring guide.

### Run Capacity Tests

Test the contract's full capacity, performance, and limits:

```bash
npm run test:capacity
```

Or with environment variables:

```bash
npm run test:capacity:amoy
```

### All Test Commands

```bash
npm test              # Standard test suite
npm run test:real     # Real-world scenarios
npm run test:capacity # Full capacity testing
npm run monitor       # Continuous monitoring
```

### Manual Execution

```bash
# Test once
node bot/testOracle.js

# Monitor continuously
node bot/monitorOracle.js
```

## 📊 Test Scenarios

### Standard Test Suite (`npm test`)

1. **Critical Damping (Optimal)**: η = λ = 1/√2
   - Expected: Δ ≈ 230, IsOptimal = true

2. **Origin (Zero State)**: η = λ = 0
   - Tests edge case handling

3. **High Damping**: η = 0.9, λ = 0.4
   - Tests non-optimal state

4. **Low Damping**: η = 0.4, λ = 0.9
   - Tests non-optimal state

5. **Balanced (Near Optimal)**: η = λ = 0.7
   - Tests near-optimal conditions

### Real-World Scenarios (`npm run test:real`)

1. **Optimal State**: Network at peak efficiency
   - Tests critical damping conditions
   - Validates optimal performance metrics

2. **High Stress**: Network under congestion
   - Simulates high transaction load
   - Tests degradation detection

3. **Recovery**: Network returning to normal
   - Tests recovery patterns
   - Validates efficiency improvements

4. **Failure State**: Critical network failure
   - Tests failure detection
   - Validates error handling

5. **Continuous Monitoring**: Multiple readings over time
   - Simulates real-time monitoring
   - Tests consistency and stability

6. **Boundary Conditions**: Contract limits
   - Tests Planck boundaries
   - Validates edge case handling

## 🔧 CI/CD

This repository includes GitHub Actions workflows that:

- Run tests on every push/PR
- Schedule daily health checks
- Upload test artifacts
- Comment on PRs with results

See `.github/workflows/oracle-tests.yml` for details.

## 🐳 Docker

```bash
# Build image
docker build -t oracle-monitor .

# Run container
docker run -d \
  --name oracle-monitor \
  --restart unless-stopped \
  -e ORACLE_ADDRESS=0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE \
  -e MONITOR_INTERVAL_MINUTES=5 \
  oracle-monitor

# View logs
docker logs -f oracle-monitor
```

Or use docker-compose:

```bash
docker-compose up -d
docker-compose logs -f
```

## 🔄 Systemd Service

```bash
# Setup (requires root)
sudo ./scripts/setup-monitor.sh

# Start service
sudo systemctl start oracle-monitor

# Check status
sudo systemctl status oracle-monitor

# View logs
sudo journalctl -u oracle-monitor -f
```

## 📁 Project Structure

```
.
├── bot/
│   ├── testOracle.js          # Test suite
│   ├── monitorOracle.js        # Monitoring bot
│   └── README.md              # Bot documentation
├── scripts/
│   └── setup-monitor.sh       # Systemd setup script
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .github/
│   └── workflows/
│       └── oracle-tests.yml   # CI/CD workflow
├── .env.example               # Environment template
├── package.json
└── README.md                  # This file
```

## 🔗 Contract Information

**Deployed Contract**:
- **Address**: `0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE`
- **Network**: Polygon Amoy Testnet
- **Explorer**: https://amoy.polygonscan.com/address/0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE
- **Status**: ✅ Verified

## 📖 Documentation

- [Bot Documentation](./bot/README.md) - Detailed bot usage
- [CI/CD Setup](./docs/CI_CD_SETUP.md) - CI/CD configuration
- [Quick Reference](./docs/QUICK_REFERENCE.md) - Common commands

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- COINjecture Protocol Team
- Polygon Network for testnet infrastructure

## 📧 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the [documentation](./bot/README.md)
- Review [troubleshooting guide](./docs/CI_CD_SETUP.md#troubleshooting)

