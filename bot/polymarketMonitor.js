const { ethers } = require("ethers");
require("dotenv").config();
const contractABI = require("./contractABI.json");

const CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE";
const RPC_URL = process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const POLYGON_RPC = process.env.POLYGON_RPC || "https://polygon-rpc.com";

// Polymarket GraphQL Subgraphs (Public, No Auth Required)
const ORDERBOOK_SUBGRAPH = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/prod/gn";
const PNL_SUBGRAPH = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn";
const OI_SUBGRAPH = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/oi-subgraph/0.0.6/gn";

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
     * Fetch market data from Polymarket GraphQL Subgraph
     * Uses public Goldsky orderbook subgraph - no authentication required
     */
    async fetchPolymarketMarket(marketSlugOrId) {
        try {
            // Query orderbooks for volume data
            const orderbookQuery = `
                query GetOrderbooks {
                    orderbooks(first: 10) {
                        id
                        buysQuantity
                        sellsQuantity
                        collateralBuyVolume
                        collateralSellVolume
                        scaledCollateralBuyVolume
                        scaledCollateralSellVolume
                    }
                }
            `;

            // Query recent order filled events for price data
            const orderEventsQuery = `
                query GetRecentTrades {
                    orderFilledEvents(
                        first: 50,
                        orderBy: timestamp,
                        orderDirection: desc
                    ) {
                        id
                        timestamp
                        makerAmountFilled
                        takerAmountFilled
                        makerAssetId
                        takerAssetId
                    }
                }
            `;

            // Query market data
            const marketDataQuery = `
                query GetMarketData {
                    marketDatas(first: 10) {
                        id
                        condition
                        outcomeIndex
                    }
                }
            `;

            // Fetch orderbook data
            const obResponse = await fetch(ORDERBOOK_SUBGRAPH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: orderbookQuery })
            });

            const obData = await obResponse.json();

            // Fetch recent trades for price calculation
            const eventsResponse = await fetch(ORDERBOOK_SUBGRAPH, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: orderEventsQuery })
            });

            const eventsData = await eventsResponse.json();

            // Process data
            if (obData.data?.orderbooks && obData.data.orderbooks.length > 0) {
                const orderbook = obData.data.orderbooks[0]; // Use first orderbook
                
                // Calculate prices from recent trades
                let recentPrice = 0.5; // Default
                if (eventsData.data?.orderFilledEvents && eventsData.data.orderFilledEvents.length > 0) {
                    // Use most recent trade to estimate price
                    const recentTrade = eventsData.data.orderFilledEvents[0];
                    // Price approximation from filled amounts
                    const makerAmount = parseFloat(recentTrade.makerAmountFilled || 0);
                    const takerAmount = parseFloat(recentTrade.takerAmountFilled || 0);
                    if (makerAmount + takerAmount > 0) {
                        recentPrice = makerAmount / (makerAmount + takerAmount);
                    }
                }

                return {
                    id: orderbook.id,
                    question: marketSlugOrId,
                    slug: marketSlugOrId,
                    orders: [], // Orderbook doesn't have individual orders
                    volume: parseFloat(orderbook.collateralVolume || 0),
                    liquidity: parseFloat(orderbook.scaledCollateralVolume || 0),
                    bidVolume: parseFloat(orderbook.collateralBuyVolume || 0),
                    askVolume: parseFloat(orderbook.collateralSellVolume || 0),
                    buysQuantity: parseFloat(orderbook.buysQuantity || 0),
                    sellsQuantity: parseFloat(orderbook.sellsQuantity || 0),
                    recentPrice: recentPrice
                };
            }

            // Fallback: Use simulated data
            console.log("⚠️  Using simulated market data (subgraph not accessible)");
            return this.generateSimulatedMarket(marketSlugOrId);
        } catch (error) {
            console.error("❌ Failed to fetch from GraphQL subgraph:", error.message);
            // Return simulated data as fallback
            return this.generateSimulatedMarket(marketSlugOrId);
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
     * Calculate λ (coupling) from orderbook imbalance
     * Uses orderbook data directly
     * Strong imbalance → high coupling (herding behavior)
     */
    calculateLambdaFromOrderbook(orders) {
        if (!orders || orders.length === 0) return 0.707;

        // Separate bids (buy orders) and asks (sell orders)
        const bids = orders.filter(o => o.side === 'buy' || o.side === 'bid' || o.side === 'yes');
        const asks = orders.filter(o => o.side === 'sell' || o.side === 'ask' || o.side === 'no');

        // Calculate total volume on each side
        const bidVolume = bids.reduce((sum, o) => sum + parseFloat(o.size || 0), 0);
        const askVolume = asks.reduce((sum, o) => sum + parseFloat(o.size || 0), 0);

        if (bidVolume === 0 && askVolume === 0) return 0.707;

        // Order book imbalance: (bid - ask) / (bid + ask)
        // Range: -1 (all asks) to +1 (all bids)
        const totalVolume = bidVolume + askVolume;
        const imbalance = (bidVolume - askVolume) / totalVolume;

        // Strong imbalance (|imbalance| → 1) → high coupling
        // Balanced (imbalance → 0) → moderate coupling
        const couplingStrength = Math.abs(imbalance);

        // Scale to critical damping range (0.3 to 0.9)
        // At critical: both η and λ should be ~0.707
        const lambda = 0.3 + (couplingStrength * 0.6);

        return Math.max(0.1, Math.min(0.95, lambda));
    }

    /**
     * Calculate λ (coupling) from betting imbalance (fallback)
     */
    calculateLambda(yesVolume, noVolume, yesPrice, noPrice) {
        if (yesVolume === 0 && noVolume === 0) return 0.707;

        const totalVolume = yesVolume + noVolume;
        const imbalance = totalVolume > 0 ? (yesVolume - noVolume) / totalVolume : 0;

        const priceSpread = Math.abs(yesPrice - noPrice);
        const spreadFactor = Math.max(0, 1 - priceSpread * 2);

        const couplingStrength = (Math.abs(imbalance) + spreadFactor) / 2;
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
                
                if (!market) {
                    console.log("⚠️  Market data not available, retrying...\n");
                    if (this.isRunning) {
                        setTimeout(poll, this.updateInterval);
                    }
                    return;
                }

                // Extract market data from GraphQL response
                const bidVolume = parseFloat(market.bidVolume || market.collateralBuyVolume || 0);
                const askVolume = parseFloat(market.askVolume || market.collateralSellVolume || 0);
                const buysQuantity = parseFloat(market.buysQuantity || 0);
                const sellsQuantity = parseFloat(market.sellsQuantity || 0);
                const volume = parseFloat(market.volume || market.collateralVolume || 0);
                const liquidity = parseFloat(market.liquidity || market.scaledCollateralVolume || 0);

                // Use recent price from trades, or default to 0.5
                const currentPrice = market.recentPrice || 0.5;

                // Update price history
                this.priceHistory.push(currentPrice);
                if (this.priceHistory.length > this.maxHistorySize) {
                    this.priceHistory.shift();
                }

                // Calculate parameters
                // η (damping): From price volatility
                const eta = this.calculateEta(this.priceHistory);
                
                // λ (coupling): From orderbook imbalance
                // Use buy/sell volume imbalance
                const lambda = this.calculateLambda(bidVolume, askVolume, currentPrice, 1 - currentPrice);

                // Best bid/ask approximation from price
                const bestBid = currentPrice * 0.99; // Slightly below mid
                const bestAsk = currentPrice * 1.01; // Slightly above mid

                // Compute oracle delta
                const result = await this.computeOracleDelta(eta, lambda);

                if (result) {
                    this.updateStats(result);
                    this.displayReading(marketSlug, market.question || marketSlug, {
                        bestBid,
                        bestAsk,
                        midPrice: currentPrice,
                        bidVolume,
                        askVolume,
                        buysQuantity,
                        sellsQuantity,
                        totalVolume: volume,
                        liquidity,
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
        if (data.bestBid !== undefined) {
            console.log(`   Price: $${data.midPrice.toFixed(3)} (Bid: $${data.bestBid.toFixed(3)}, Ask: $${data.bestAsk.toFixed(3)})`);
            console.log(`   Volume: Buy=${data.bidVolume.toFixed(0)}, Sell=${data.askVolume.toFixed(0)}`);
            console.log(`   Orders: Buy=${data.buysQuantity || 0}, Sell=${data.sellsQuantity || 0}`);
            console.log(`   Total Volume: ${data.totalVolume.toFixed(0)} | Liquidity: ${data.liquidity.toFixed(0)}`);
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

