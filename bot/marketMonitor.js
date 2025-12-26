const { ethers } = require("ethers");
const WebSocket = require("ws");
const https = require("https");
require("dotenv").config();
const contractABI = require("./contractABI.json");

const CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE";
const RPC_URL = process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology";

/**
 * Real-World Market Monitor
 * Maps live market data to Holographic Oracle parameters (η, λ)
 * Monitors for critical equilibrium (Δ ≈ 231)
 */
class MarketMonitor {
    constructor(options = {}) {
        this.oracle = null;
        this.provider = null;
        this.priceHistory = [];
        this.maxHistorySize = options.maxHistorySize || 1000;
        this.updateInterval = options.updateInterval || 1000; // ms
        this.isRunning = false;
        this.stats = {
            readings: 0,
            optimalCount: 0,
            avgDelta: 0,
            avgEfficiency: 0
        };
    }

    async connect() {
        console.log("🔗 Connecting to Holographic Oracle...");
        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.oracle = new ethers.Contract(CONTRACT_ADDRESS, contractABI, this.provider);
            console.log("✅ Connected to oracle contract!\n");
            return true;
        } catch (error) {
            console.error("❌ Failed to connect:", error.message);
            return false;
        }
    }

    /**
     * Calculate η (damping rate) from market volatility
     * High volatility → low damping (quick mean-reversion fails)
     * Low volatility → high damping (slow convergence)
     */
    calculateEta(priceHistory) {
        if (priceHistory.length < 10) return 0.707; // Default to critical damping

        // Calculate rolling volatility (standard deviation of returns)
        const returns = [];
        for (let i = 1; i < priceHistory.length; i++) {
            const ret = (priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1];
            returns.push(ret);
        }

        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);

        // Normalize volatility (0 to 1)
        const normalizedVol = Math.min(volatility * 100, 1); // Scale appropriately

        // Map to damping: high vol → low η, low vol → high η
        // η ≈ 1 / (1 + normalized_volatility)
        // Scale to critical damping range (0.3 to 0.9)
        const eta = 0.3 + (0.6 / (1 + normalizedVol * 10));

        return Math.max(0.1, Math.min(0.95, eta)); // Clamp to valid range
    }

    /**
     * Calculate λ (coupling strength) from order book imbalance
     * Strong imbalance → high coupling (herding behavior)
     * Balanced book → low coupling (independent actors)
     */
    calculateLambda(bidVolume, askVolume) {
        if (bidVolume === 0 && askVolume === 0) return 0.707; // Default

        // Order book imbalance: (bid - ask) / (bid + ask)
        // Range: -1 (all asks) to +1 (all bids)
        const imbalance = (bidVolume - askVolume) / (bidVolume + askVolume + 1e-10);

        // Map to coupling: imbalance → coupling strength
        // Strong imbalance (|imbalance| → 1) → high coupling
        // Balanced (imbalance → 0) → moderate coupling
        const couplingStrength = Math.abs(imbalance);

        // Scale to critical damping range (0.3 to 0.9)
        // At critical: both η and λ should be ~0.707
        const lambda = 0.3 + (couplingStrength * 0.6);

        return Math.max(0.1, Math.min(0.95, lambda)); // Clamp to valid range
    }

    /**
     * Alternative: Calculate λ from price momentum/trend
     * Strong trend → high coupling (participants aligning)
     */
    calculateLambdaFromMomentum(priceHistory) {
        if (priceHistory.length < 20) return 0.707;

        // Calculate momentum (rate of change)
        const recent = priceHistory.slice(-20);
        const momentum = (recent[recent.length - 1] - recent[0]) / recent[0];

        // Strong momentum → high coupling
        const momentumStrength = Math.abs(momentum);
        const lambda = 0.3 + Math.min(momentumStrength * 5, 0.6);

        return Math.max(0.1, Math.min(0.95, lambda));
    }

    async computeOracleDelta(eta, lambda) {
        try {
            // Scale to 1e9 for contract
            const etaScaled = Math.floor(eta * 1e9);
            const lambdaScaled = Math.floor(lambda * 1e9);

            const delta = await this.oracle.computeDelta(etaScaled, lambdaScaled);
            const efficiency = await this.oracle.efficiency(delta);
            const isOptimal = await this.oracle.isOptimal(delta);

            return {
                delta: Number(delta),
                deltaDecimal: Number(delta) / 1000,
                efficiency: Number(efficiency),
                efficiencyPercent: (Number(efficiency) / 1e9) * 100,
                isOptimal,
                eta,
                lambda
            };
        } catch (error) {
            console.error("❌ Oracle call failed:", error.message);
            return null;
        }
    }

    /**
     * Monitor Binance market (crypto)
     */
    async monitorBinance(symbol = "BTCUSDT") {
        console.log(`📊 Monitoring Binance: ${symbol}`);
        console.log("   Connecting to WebSocket...\n");

        // Binance WebSocket format: wss://stream.binance.com:9443/ws/btcusdt@ticker
        const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`;
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log("✅ Connected to Binance WebSocket\n");
            this.isRunning = true;
        });

        ws.on('message', async (data) => {
            try {
                const ticker = JSON.parse(data.toString());
                
                if (ticker.c) { // Current price
                    const price = parseFloat(ticker.c);
                    const volume = parseFloat(ticker.v);
                    
                    // Update price history
                    this.priceHistory.push(price);
                    if (this.priceHistory.length > this.maxHistorySize) {
                        this.priceHistory.shift();
                    }

                    // Calculate η from volatility
                    const eta = this.calculateEta(this.priceHistory);

                    // Calculate λ from price momentum (alternative: use order book if available)
                    const lambda = this.calculateLambdaFromMomentum(this.priceHistory);

                    // Compute oracle delta
                    const result = await this.computeOracleDelta(eta, lambda);

                    if (result) {
                        this.updateStats(result);
                        this.displayReading(symbol, price, result);

                        // Alert on critical equilibrium
                        if (result.isOptimal) {
                            this.alertCriticalEquilibrium(symbol, price, result);
                        }
                    }
                }
            } catch (error) {
                console.error("❌ Error processing market data:", error.message);
            }
        });

        ws.on('error', (error) => {
            console.error("❌ WebSocket error:", error.message);
        });

        ws.on('close', () => {
            console.log("\n⚠️  WebSocket closed. Reconnecting...");
            if (this.isRunning) {
                setTimeout(() => this.monitorBinance(symbol), 5000);
            }
        });
    }

    /**
     * Monitor using REST API (fallback or polling)
     */
    async monitorRestAPI(symbol = "BTCUSDT", source = "binance") {
        console.log(`📊 Monitoring ${source.toUpperCase()}: ${symbol} (REST API)\n`);

        this.isRunning = true;

        const poll = async () => {
            try {
                let price, volume;

                if (source === "binance") {
                    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
                    const data = await response.json();
                    price = parseFloat(data.lastPrice);
                    volume = parseFloat(data.volume);
                } else if (source === "polygon") {
                    // Polygon.io API (requires API key)
                    const apiKey = process.env.POLYGON_API_KEY;
                    if (!apiKey) {
                        console.error("❌ POLYGON_API_KEY not set");
                        return;
                    }
                    const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apikey=${apiKey}`);
                    const data = await response.json();
                    price = data.results[0].c; // Close price
                    volume = data.results[0].v; // Volume
                }

                if (price) {
                    this.priceHistory.push(price);
                    if (this.priceHistory.length > this.maxHistorySize) {
                        this.priceHistory.shift();
                    }

                    const eta = this.calculateEta(this.priceHistory);
                    const lambda = this.calculateLambdaFromMomentum(this.priceHistory);
                    const result = await this.computeOracleDelta(eta, lambda);

                    if (result) {
                        this.updateStats(result);
                        this.displayReading(symbol, price, result);

                        if (result.isOptimal) {
                            this.alertCriticalEquilibrium(symbol, price, result);
                        }
                    }
                }
            } catch (error) {
                console.error("❌ API error:", error.message);
            }

            if (this.isRunning) {
                setTimeout(poll, this.updateInterval);
            }
        };

        await poll();
    }

    updateStats(result) {
        this.stats.readings++;
        this.stats.avgDelta = (this.stats.avgDelta * (this.stats.readings - 1) + result.delta) / this.stats.readings;
        this.stats.avgEfficiency = (this.stats.avgEfficiency * (this.stats.readings - 1) + result.efficiencyPercent) / this.stats.readings;
        if (result.isOptimal) {
            this.stats.optimalCount++;
        }
    }

    displayReading(symbol, price, result) {
        const timestamp = new Date().toISOString();
        const status = result.isOptimal ? "🎯 OPTIMAL" : result.deltaDecimal > 0.2 ? "✅ Healthy" : "⚠️  Suboptimal";
        
        console.log(`[${timestamp}] ${symbol}: $${price.toFixed(2)}`);
        console.log(`   η=${result.eta.toFixed(3)}, λ=${result.lambda.toFixed(3)}`);
        console.log(`   Δ=${result.delta} (${result.deltaDecimal.toFixed(3)})`);
        console.log(`   Efficiency: ${result.efficiencyPercent.toFixed(2)}%`);
        console.log(`   Status: ${status}`);
        console.log(`   Stats: ${this.stats.readings} readings, ${this.stats.optimalCount} optimal (${(this.stats.optimalCount/this.stats.readings*100).toFixed(1)}%)\n`);
    }

    alertCriticalEquilibrium(symbol, price, result) {
        console.log("=".repeat(70));
        console.log("🚨 CRITICAL EQUILIBRIUM DETECTED!");
        console.log("=".repeat(70));
        console.log(`Market: ${symbol}`);
        console.log(`Price: $${price.toFixed(2)}`);
        console.log(`Δ: ${result.delta} (${result.deltaDecimal.toFixed(3)})`);
        console.log(`Efficiency: ${result.efficiencyPercent.toFixed(2)}%`);
        console.log(`η: ${result.eta.toFixed(3)}, λ: ${result.lambda.toFixed(3)}`);
        console.log("=".repeat(70));
        console.log("🎯 MARKET IN TRUTH-FINDING EQUILIBRIUM — HIGH CONFIDENCE SIGNAL!");
        console.log("=".repeat(70) + "\n");
    }

    stop() {
        this.isRunning = false;
        console.log("\n🛑 Market monitoring stopped");
        console.log(`   Total readings: ${this.stats.readings}`);
        console.log(`   Optimal readings: ${this.stats.optimalCount}`);
        console.log(`   Average Δ: ${this.stats.avgDelta.toFixed(1)}`);
        console.log(`   Average Efficiency: ${this.stats.avgEfficiency.toFixed(2)}%`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const symbol = args[0] || "BTCUSDT";
    const source = args[1] || "binance";
    const mode = args[2] || "ws"; // "ws" or "rest"

    console.log("=".repeat(70));
    console.log("🌍 REAL-WORLD MARKET MONITOR");
    console.log("=".repeat(70));
    console.log(`Symbol: ${symbol}`);
    console.log(`Source: ${source}`);
    console.log(`Mode: ${mode === "ws" ? "WebSocket" : "REST API"}\n`);

    const monitor = new MarketMonitor({
        maxHistorySize: 1000,
        updateInterval: 1000
    });

    const connected = await monitor.connect();
    if (!connected) {
        console.error("❌ Failed to connect to oracle. Exiting.");
        process.exit(1);
    }

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n\n🛑 Received SIGINT, shutting down...");
        monitor.stop();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        console.log("\n\n🛑 Received SIGTERM, shutting down...");
        monitor.stop();
        process.exit(0);
    });

    // Start monitoring
    if (mode === "ws" && source === "binance") {
        await monitor.monitorBinance(symbol);
    } else {
        await monitor.monitorRestAPI(symbol, source);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}

module.exports = { MarketMonitor };

