# Real-World Market Monitoring Guide

Monitor live markets using the Holographic Oracle to detect critical equilibrium (Δ ≈ 231).

## Quick Start

### Monitor Bitcoin (Binance WebSocket)

```bash
npm run monitor:btc
```

### Monitor Ethereum

```bash
npm run monitor:eth
```

### Monitor Custom Symbol

```bash
npm run monitor:market SYMBOL SOURCE MODE

# Examples:
node bot/marketMonitor.js BTCUSDT binance ws
node bot/marketMonitor.js ETHUSDT binance ws
node bot/marketMonitor.js AAPL polygon rest
```

## How It Works

### Parameter Mapping

**η (Damping Rate)** - Measures resistance to change
- **High volatility** → Low damping (quick mean-reversion fails)
- **Low volatility** → High damping (slow convergence)
- **Calculation**: `η ≈ 1 / (1 + normalized_volatility)`
- **Proxy**: Rolling standard deviation of returns

**λ (Coupling Strength)** - Measures synchronization
- **Strong imbalance** → High coupling (herding behavior)
- **Balanced market** → Low coupling (independent actors)
- **Calculation**: `λ ≈ |order_book_imbalance|` or `|price_momentum|`
- **Proxy**: Order book imbalance or price momentum

### Critical Equilibrium

When **Δ ≈ 231** (scaled), the market is in:
- ✅ **Critical damping** - Optimal convergence
- ✅ **Truth-finding equilibrium** - High confidence in outcome
- ✅ **Maximum efficiency** - ~81% efficiency

## Market Data Sources

### Binance (Crypto) - Recommended

**WebSocket** (Real-time):
```bash
npm run monitor:btc
```

**REST API** (Polling):
```bash
node bot/marketMonitor.js BTCUSDT binance rest
```

### Polygon.io (Stocks/Options)

Requires API key:
```bash
export POLYGON_API_KEY=your_key_here
node bot/marketMonitor.js AAPL polygon rest
```

### Alpha Vantage (Stocks/Forex)

Requires API key:
```bash
export ALPHA_VANTAGE_API_KEY=your_key_here
node bot/marketMonitor.js AAPL alphavantage rest
```

## Output Example

```
[2025-12-26T21:30:00.000Z] BTCUSDT: $43250.50
   η=0.707, λ=0.685
   Δ=230 (0.230)
   Efficiency: 81.30%
   Status: 🎯 OPTIMAL
   Stats: 150 readings, 12 optimal (8.0%)

======================================================================
🚨 CRITICAL EQUILIBRIUM DETECTED!
======================================================================
Market: BTCUSDT
Price: $43250.50
Δ: 230 (0.230)
Efficiency: 81.30%
η: 0.707, λ: 0.685
======================================================================
🎯 MARKET IN TRUTH-FINDING EQUILIBRIUM — HIGH CONFIDENCE SIGNAL!
======================================================================
```

## Monitoring Prediction Markets

### Polymarket via Crypto Pairs

1. **Identify event tokens** (e.g., election outcome tokens)
2. **Monitor on Binance** if listed, or use DEX prices
3. **Map to parameters**:
   - **η**: Resolution volatility (how much price swings)
   - **λ**: Betting imbalance (buy vs sell pressure)

### Example: Election Market

```bash
# Monitor election token pair
node bot/marketMonitor.js ELECTIONUSDT binance ws

# When Δ ≈ 231:
# - Market has reached consensus
# - High confidence in outcome
# - Optimal truth-finding state
```

## Configuration

### Environment Variables

```bash
# Oracle contract
ORACLE_ADDRESS=0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Market data APIs (optional)
POLYGON_API_KEY=your_key
ALPHA_VANTAGE_API_KEY=your_key
```

### Customization

Edit `bot/marketMonitor.js` to:
- Adjust volatility calculation window
- Change coupling calculation method
- Add custom data sources
- Modify alert thresholds

## Interpretation

### Δ Values

- **Δ ≈ 230**: 🎯 **Critical equilibrium** - Optimal state
- **Δ > 250**: ⚠️ **Overdamped** - Slow convergence
- **Δ < 200**: ⚠️ **Underdamped** - Oscillatory, unstable
- **Δ < 0**: ❌ **Failure state** - System breakdown

### Efficiency

- **~81%**: Optimal (Δ ≈ 230)
- **>85%**: Over-conservative
- **<70%**: Suboptimal performance

## Use Cases

1. **Trading Signals**: Alert when market reaches critical equilibrium
2. **Risk Management**: Monitor for system instability (Δ < 0)
3. **Market Analysis**: Track efficiency over time
4. **Prediction Markets**: Detect consensus formation (Polymarket)
5. **Portfolio Optimization**: Balance based on oracle readings

## Troubleshooting

### WebSocket Connection Issues

```bash
# Fallback to REST API
node bot/marketMonitor.js BTCUSDT binance rest
```

### API Rate Limits

- Binance: 1200 requests/minute (WebSocket recommended)
- Polygon: Varies by plan
- Alpha Vantage: 5 calls/minute (free tier)

### No Data

- Check symbol format (e.g., `BTCUSDT` not `BTC/USD`)
- Verify API keys if using paid services
- Check network connectivity

## Next Steps

1. **Set up alerts**: Integrate with notification services
2. **Historical analysis**: Store readings in database
3. **Multi-asset monitoring**: Monitor multiple markets simultaneously
4. **Dashboard**: Create visualization of Δ over time
5. **Trading bot**: Automate trades based on oracle signals

## Resources

- [Binance WebSocket API](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- [Polygon.io API](https://polygon.io/docs)
- [Holographic Oracle Contract](https://amoy.polygonscan.com/address/0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE)

