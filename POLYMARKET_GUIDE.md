# Polymarket Monitoring Guide

Monitor prediction markets on Polymarket using the Holographic Oracle to detect when markets reach critical equilibrium (Δ ≈ 231).

## Quick Start

### Monitor Default Market (2024 Election)

```bash
npm run monitor:polymarket
```

### Monitor Specific Market

```bash
node bot/polymarketMonitor.js MARKET_SLUG

# Example: 2024 Election
npm run monitor:polymarket:trump

# Example: Custom market
node bot/polymarketMonitor.js will-bitcoin-reach-100k-in-2025
```

## How It Works

### Parameter Mapping for Prediction Markets

**η (Damping Rate)** - Resolution Volatility
- **High volatility** → Low damping (uncertain outcome, price swings)
- **Low volatility** → High damping (stable, converging to resolution)
- **Calculation**: Based on price history volatility
- **Interpretation**: How much the market price oscillates before resolution

**λ (Coupling Strength)** - Betting Imbalance & Consensus
- **Strong imbalance** → High coupling (herding, consensus forming)
- **Balanced betting** → Low coupling (disagreement, uncertainty)
- **Calculation**: `(yes_volume - no_volume) / total_volume` + price spread
- **Interpretation**: How strongly participants align on outcome

### Critical Equilibrium (Δ ≈ 231)

When a prediction market reaches **Δ ≈ 231**, it means:
- ✅ **Truth-finding equilibrium** - Market has reached consensus
- ✅ **High confidence** - Outcome is likely correct
- ✅ **Optimal efficiency** - ~81% efficiency
- ✅ **Resolution ready** - Market is stable and ready to resolve

## Finding Market Slugs

### Method 1: From Polymarket URL

1. Go to https://polymarket.com
2. Find a market you want to monitor
3. Copy the slug from the URL:
   ```
   https://polymarket.com/event/will-donald-trump-win-the-2024-us-presidential-election
                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                 This is the market slug
   ```

### Method 2: Browse Markets

Popular markets to monitor:
- `will-donald-trump-win-the-2024-us-presidential-election`
- `will-bitcoin-reach-100k-in-2025`
- `will-ethereum-reach-5000-in-2025`
- `will-tesla-stock-reach-300-in-2025`

## Example Output

```
[2025-12-26T22:00:00.000Z] will-donald-trump-win-the-2024-us-presidential-election
   Question: Will Donald Trump win the 2024 US Presidential Election?
   Yes: $0.523 | No: $0.477
   Volume: Yes=1250000, No=980000
   η=0.685, λ=0.712
   Δ=231 (0.231)
   Efficiency: 81.30%
   Status: 🎯 OPTIMAL
   Stats: 150 readings, 8 optimal (5.3%)

======================================================================
🚨 CRITICAL EQUILIBRIUM DETECTED!
======================================================================
Market: will-donald-trump-win-the-2024-us-presidential-election
Question: Will Donald Trump win the 2024 US Presidential Election?
Δ: 231 (0.231)
Efficiency: 81.30%
η: 0.707, λ: 0.685
======================================================================
🎯 PREDICTION MARKET IN TRUTH-FINDING EQUILIBRIUM!
   High confidence in outcome - Market has reached consensus
======================================================================
```

## Interpretation

### Δ Values for Prediction Markets

- **Δ ≈ 230**: 🎯 **Critical equilibrium** - Market has reached consensus, high confidence
- **Δ > 250**: ⚠️ **Overdamped** - Market is too stable, may be manipulated or illiquid
- **Δ < 200**: ⚠️ **Underdamped** - Market is oscillatory, uncertain, low confidence
- **Δ < 0**: ❌ **Failure state** - Market breakdown, extreme uncertainty

### When to Trust the Market

**High Confidence (Δ ≈ 230)**:
- Market has reached consensus
- Outcome is likely correct
- Good time to take position (if you agree)
- Market is ready for resolution

**Low Confidence (Δ < 200 or Δ > 250)**:
- Market is uncertain or manipulated
- Wait for more data
- Consider the market may be illiquid

## Use Cases

1. **Election Monitoring**: Track election prediction markets
2. **Event Outcomes**: Monitor sports, awards, etc.
3. **Price Predictions**: Track price target markets
4. **Consensus Detection**: Identify when markets reach agreement
5. **Trading Signals**: Use equilibrium alerts for trading

## Configuration

### Environment Variables

```bash
# Oracle contract
ORACLE_ADDRESS=0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Polygon mainnet (for Polymarket data)
POLYGON_RPC=https://polygon-rpc.com
```

### Customization

Edit `bot/polymarketMonitor.js` to:
- Adjust update interval (default: 5 seconds)
- Change volatility calculation window
- Modify coupling calculation method
- Add custom market filters

## API Limitations

Polymarket's public API has rate limits:
- **Free tier**: Limited requests
- **Recommendation**: Use 5-10 second intervals
- **Alternative**: Use Polymarket's GraphQL API with authentication

## Troubleshooting

### Market Not Found

```bash
# Check market slug is correct
# Visit https://polymarket.com/event/MARKET_SLUG to verify
```

### No Data

- Market may be closed or resolved
- Check market is active on Polymarket
- Verify market slug format

### API Errors

- Check network connectivity
- Verify Polymarket API is accessible
- Consider using longer update intervals

## Advanced: Multiple Markets

Monitor multiple markets simultaneously:

```bash
# Terminal 1
node bot/polymarketMonitor.js market-1

# Terminal 2
node bot/polymarketMonitor.js market-2

# Terminal 3
node bot/polymarketMonitor.js market-3
```

## Resources

- [Polymarket](https://polymarket.com)
- [Polymarket API Docs](https://docs.polymarket.com)
- [Holographic Oracle Contract](https://amoy.polygonscan.com/address/0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE)

## Next Steps

1. **Set up alerts**: Get notified when markets reach equilibrium
2. **Historical analysis**: Track Δ over time for markets
3. **Multi-market dashboard**: Monitor multiple markets at once
4. **Trading integration**: Automate trades based on oracle signals
5. **Research**: Study which markets reach equilibrium most often

