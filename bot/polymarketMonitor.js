const { ethers } = require("ethers");
require("dotenv").config();
const contractABI = require("./contractABI.json");

const CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE";
const RPC_URL = process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const POLYGON_RPC = process.env.POLYGON_RPC || "https://polygon-rpc.com";

/**
 * Polymarket Prediction Market Monitor
 * Monitors prediction markets and maps to Holographic Oracle
 */
class PolymarketMonitor {
    constructor(options = {}) {
        this.oracle = null;
        this.provider = null;
        this.polygonProvider = null;
        this.priceHistory = [];
        this.maxHistorySize = options.maxHistorySize || 1000;
        this.updateInterval = options.updateInterval || 5000; // 5 seconds
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
            
            // Also connect to Polygon mainnet for Polymarket data
            this.polygonProvider = new ethers.JsonRpcProvider(POLYGON_RPC);
            
            console.log("✅ Connected to oracle contract!");
            console.log("✅ Connected to Polygon network!\n");
            return true;
        } catch (error) {
            console.error("❌ Failed to connect:", error.message);
            return false;
        }
    }

    /**
     * Fetch market data from Polymarket API
     * Uses Polymarket's public API endpoints
     */
    async fetchPolymarketMarket(marketSlug) {
        try {
            // Try multiple API endpoints
            const endpoints = [
                `https://clob.polymarket.com/markets/${marketSlug}`,
                `https://api.polymarket.com/markets/${marketSlug}`,
                `https://clob.polymarket.com/markets?slug=${marketSlug}`,
            ];

            for (const url of endpoints) {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'OracleBot/1.0.0'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data && (data.id || data.slug || data.tokens)) {
                            return data;
                        }
                        // If array response, find matching market
                        if (Array.isArray(data) && data.length > 0) {
                            const market = data.find(m => m.slug === marketSlug || m.id === marketSlug);
                            if (market) return market;
                        }
                    }
                } catch (e) {
                    // Try next endpoint
                    continue;
                }
            }

            // Fallback: Use simulated data for testing
            console.log("⚠️  Using simulated market data (API not accessible)");
            return this.generateSimulatedMarket(marketSlug);
        } catch (error) {
            console.error("❌ Failed to fetch Polymarket data:", error.message);
            // Return simulated data as fallback
            return this.generateSimulatedMarket(marketSlug);
        }
    }

    /**
     * Generate simulated market data for testing
     * Useful when API is not accessible
     */
    generateSimulatedMarket(marketSlug) {
        // Simulate market with some randomness
        const basePrice = 0.5 + (Math.random() - 0.5) * 0.2; // 0.4 to 0.6
        const yesPrice = Math.max(0.1, Math.min(0.9, basePrice));
        const noPrice = 1 - yesPrice;

        return {
            slug: marketSlug,
            question: marketSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            tokens: [
                {
                    outcome: 'Yes',
                    side: 'yes',
                    price: yesPrice.toFixed(3),
                    lastPrice: yesPrice.toFixed(3),
                    volume24h: (Math.random() * 1000000 + 500000).toFixed(0),
                    volume: (Math.random() * 1000000 + 500000).toFixed(0)
                },
                {
                    outcome: 'No',
                    side: 'no',
                    price: noPrice.toFixed(3),
                    lastPrice: noPrice.toFixed(3),
                    volume24h: (Math.random() * 1000000 + 500000).toFixed(0),
                    volume: (Math.random() * 1000000 + 500000).toFixed(0)
                }
            ]
        };
    }

    /**
     * Calculate η (damping) from market volatility
     * For prediction markets: resolution volatility
     */
    calculateEta(priceHistory) {
        if (priceHistory.length < 10) return 0.707;

        const returns = [];
        for (let i = 1; i < priceHistory.length; i++) {
            const ret = (priceHistory[i] - priceHistory[i - 1]) / (priceHistory[i - 1] + 1e-10);
            returns.push(ret);
        }

        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);

        // Normalize and map to damping
        const normalizedVol = Math.min(volatility * 100, 1);
        const eta = 0.3 + (0.6 / (1 + normalizedVol * 10));

        return Math.max(0.1, Math.min(0.95, eta));
    }

    /**
     * Calculate λ (coupling) from betting imbalance
     * Strong imbalance → high coupling (herding)
     */
    calculateLambda(yesVolume, noVolume, yesPrice, noPrice) {
        if (yesVolume === 0 && noVolume === 0) return 0.707;

        // Betting imbalance: (yes - no) / (yes + no)
        const totalVolume = yesVolume + noVolume;
        const imbalance = totalVolume > 0 ? (yesVolume - noVolume) / totalVolume : 0;

        // Price spread also indicates coupling
        // Tight spread → high coupling (consensus)
        // Wide spread → low coupling (disagreement)
        const priceSpread = Math.abs(yesPrice - noPrice);
        const spreadFactor = Math.max(0, 1 - priceSpread * 2); // Normalize spread

        // Combine imbalance and spread
        const couplingStrength = (Math.abs(imbalance) + spreadFactor) / 2;

        // Scale to critical damping range
        const lambda = 0.3 + (couplingStrength * 0.6);

        return Math.max(0.1, Math.min(0.95, lambda));
    }

    /**
     * Alternative: Calculate λ from price momentum
     */
    calculateLambdaFromMomentum(priceHistory) {
        if (priceHistory.length < 20) return 0.707;

        const recent = priceHistory.slice(-20);
        const momentum = (recent[recent.length - 1] - recent[0]) / (recent[0] + 1e-10);

        const momentumStrength = Math.abs(momentum);
        const lambda = 0.3 + Math.min(momentumStrength * 5, 0.6);

        return Math.max(0.1, Math.min(0.95, lambda));
    }

    async computeOracleDelta(eta, lambda) {
        try {
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
     * Monitor Polymarket market by slug
     */
    async monitorMarket(marketSlug) {
        console.log(`📊 Monitoring Polymarket: ${marketSlug}`);
        console.log("   Fetching market data...\n");

        this.isRunning = true;

        const poll = async () => {
            try {
                const market = await this.fetchPolymarketMarket(marketSlug);
                
                if (!market || !market.tokens) {
                    console.log("⚠️  Market data not available, retrying...\n");
                    if (this.isRunning) {
                        setTimeout(poll, this.updateInterval);
                    }
                    return;
                }

                // Extract market data
                const yesToken = market.tokens.find(t => t.side === 'yes' || t.outcome === 'Yes');
                const noToken = market.tokens.find(t => t.side === 'no' || t.outcome === 'No');

                if (!yesToken || !noToken) {
                    console.log("⚠️  Market structure not recognized\n");
                    if (this.isRunning) {
                        setTimeout(poll, this.updateInterval);
                    }
                    return;
                }

                const yesPrice = parseFloat(yesToken.price || yesToken.lastPrice || 0.5);
                const noPrice = parseFloat(noToken.price || noToken.lastPrice || 0.5);
                const yesVolume = parseFloat(yesToken.volume24h || yesToken.volume || 0);
                const noVolume = parseFloat(noToken.volume24h || noToken.volume || 0);

                // Use yes price as primary metric
                const currentPrice = yesPrice;

                // Update price history
                this.priceHistory.push(currentPrice);
                if (this.priceHistory.length > this.maxHistorySize) {
                    this.priceHistory.shift();
                }

                // Calculate parameters
                const eta = this.calculateEta(this.priceHistory);
                const lambda = this.calculateLambda(yesVolume, noVolume, yesPrice, noPrice);

                // Compute oracle delta
                const result = await this.computeOracleDelta(eta, lambda);

                if (result) {
                    this.updateStats(result);
                    this.displayReading(marketSlug, market.question || marketSlug, {
                        yesPrice,
                        noPrice,
                        yesVolume,
                        noVolume,
                        result
                    });

                    // Alert on critical equilibrium
                    if (result.isOptimal) {
                        this.alertCriticalEquilibrium(marketSlug, market.question || marketSlug, result);
                    }
                }
            } catch (error) {
                console.error("❌ Error fetching market data:", error.message);
            }

            if (this.isRunning) {
                setTimeout(poll, this.updateInterval);
            }
        };

        await poll();
    }

    /**
     * Monitor using Polymarket API (alternative method)
     */
    async monitorViaAPI(marketSlug) {
        console.log(`📊 Monitoring Polymarket via API: ${marketSlug}\n`);

        this.isRunning = true;

        const poll = async () => {
            try {
                // Polymarket GraphQL API endpoint
                const query = `
                    query GetMarket($slug: String!) {
                        market(slug: $slug) {
                            id
                            question
                            slug
                            outcomes
                            volume
                            liquidity
                            endDate
                            resolutionSource
                            marketMakerAddress
                            conditionId
                            tokens {
                                outcome
                                price
                                volume24h
                            }
                        }
                    }
                `;

                // For now, use REST endpoint as fallback
                const market = await this.fetchPolymarketMarket(marketSlug);
                
                if (market) {
                    // Process market data similar to monitorMarket
                    const yesPrice = market.tokens?.[0]?.price || 0.5;
                    const currentPrice = yesPrice;

                    this.priceHistory.push(currentPrice);
                    if (this.priceHistory.length > this.maxHistorySize) {
                        this.priceHistory.shift();
                    }

                    const eta = this.calculateEta(this.priceHistory);
                    const lambda = this.calculateLambdaFromMomentum(this.priceHistory);

                    const result = await this.computeOracleDelta(eta, lambda);

                    if (result) {
                        this.updateStats(result);
                        this.displayReading(marketSlug, market.question || marketSlug, {
                            yesPrice,
                            result
                        });

                        if (result.isOptimal) {
                            this.alertCriticalEquilibrium(marketSlug, market.question || marketSlug, result);
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

    displayReading(marketSlug, question, data) {
        const timestamp = new Date().toISOString();
        const status = data.result.isOptimal ? "🎯 OPTIMAL" : 
                      data.result.deltaDecimal > 0.2 ? "✅ Healthy" : "⚠️  Suboptimal";
        
        console.log(`[${timestamp}] ${marketSlug}`);
        console.log(`   Question: ${question}`);
        if (data.yesPrice !== undefined) {
            console.log(`   Yes: $${data.yesPrice.toFixed(3)} | No: $${data.noPrice.toFixed(3)}`);
            console.log(`   Volume: Yes=${data.yesVolume.toFixed(0)}, No=${data.noVolume.toFixed(0)}`);
        }
        console.log(`   η=${data.result.eta.toFixed(3)}, λ=${data.result.lambda.toFixed(3)}`);
        console.log(`   Δ=${data.result.delta} (${data.result.deltaDecimal.toFixed(3)})`);
        console.log(`   Efficiency: ${data.result.efficiencyPercent.toFixed(2)}%`);
        console.log(`   Status: ${status}`);
        console.log(`   Stats: ${this.stats.readings} readings, ${this.stats.optimalCount} optimal (${(this.stats.optimalCount/this.stats.readings*100).toFixed(1)}%)\n`);
    }

    alertCriticalEquilibrium(marketSlug, question, result) {
        console.log("=".repeat(70));
        console.log("🚨 CRITICAL EQUILIBRIUM DETECTED!");
        console.log("=".repeat(70));
        console.log(`Market: ${marketSlug}`);
        console.log(`Question: ${question}`);
        console.log(`Δ: ${result.delta} (${result.deltaDecimal.toFixed(3)})`);
        console.log(`Efficiency: ${result.efficiencyPercent.toFixed(2)}%`);
        console.log(`η: ${result.eta.toFixed(3)}, λ: ${result.lambda.toFixed(3)}`);
        console.log("=".repeat(70));
        console.log("🎯 PREDICTION MARKET IN TRUTH-FINDING EQUILIBRIUM!");
        console.log("   High confidence in outcome - Market has reached consensus");
        console.log("=".repeat(70) + "\n");
    }

    stop() {
        this.isRunning = false;
        console.log("\n🛑 Polymarket monitoring stopped");
        console.log(`   Total readings: ${this.stats.readings}`);
        console.log(`   Optimal readings: ${this.stats.optimalCount}`);
        console.log(`   Average Δ: ${this.stats.avgDelta.toFixed(1)}`);
        console.log(`   Average Efficiency: ${this.stats.avgEfficiency.toFixed(2)}%`);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const marketSlug = args[0] || "will-donald-trump-win-the-2024-us-presidential-election";

    console.log("=".repeat(70));
    console.log("📊 POLYMARKET PREDICTION MARKET MONITOR");
    console.log("=".repeat(70));
    console.log(`Market: ${marketSlug}\n`);

    const monitor = new PolymarketMonitor({
        maxHistorySize: 1000,
        updateInterval: 5000 // 5 seconds
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
    await monitor.monitorMarket(marketSlug);
}

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}

module.exports = { PolymarketMonitor };

