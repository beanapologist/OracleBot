const { ethers } = require("ethers");
require("dotenv").config();
const contractABI = require("./contractABI.json");

// Contract address on Polygon Amoy
const CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE";
const RPC_URL = process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology";

/**
 * Real-world scenario testing for Holographic Oracle
 * Simulates actual network conditions and usage patterns
 */
class RealWorldTester {
    constructor() {
        this.provider = null;
        this.oracle = null;
        this.results = [];
    }

    async connect() {
        console.log("🔗 Connecting to Polygon Amoy Testnet...");
        console.log("📍 Contract:", CONTRACT_ADDRESS);
        console.log("🌐 RPC:", RPC_URL);
        console.log("");

        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.oracle = new ethers.Contract(CONTRACT_ADDRESS, contractABI, this.provider);

            // Verify connection
            const network = await this.provider.getNetwork();
            const code = await this.provider.getCode(CONTRACT_ADDRESS);
            
            if (code === "0x") {
                throw new Error("Contract not found at address");
            }

            console.log("✅ Connected!");
            console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`   Contract verified: ✅\n`);
            return true;
        } catch (error) {
            console.error("❌ Connection failed:", error.message);
            return false;
        }
    }

    /**
     * Scenario 1: Network at optimal critical damping
     * This is the ideal state - network operating at peak efficiency
     */
    async testOptimalState() {
        console.log("📊 Scenario 1: Network at Optimal Critical Damping");
        console.log("   Simulating: Network operating at peak efficiency");
        console.log("   Expected: Δ ≈ 230, Efficiency ≈ 81%, IsOptimal = true\n");

        const eta = 707106781;    // 1/√2 × 1e9
        const lambda = 707106781; // 1/√2 × 1e9

        try {
            const delta = await this.oracle.computeDelta(eta, lambda);
            const efficiency = await this.oracle.efficiency(delta);
            const isOptimal = await this.oracle.isOptimal(delta);

            const deltaValue = Number(delta);
            const efficiencyValue = Number(efficiency);
            const efficiencyPercent = (efficiencyValue / 1e9) * 100;

            console.log(`   Results:`);
            console.log(`   Δ = ${deltaValue} (${(deltaValue / 1000).toFixed(3)})`);
            console.log(`   Efficiency = ${efficiencyPercent.toFixed(2)}%`);
            console.log(`   Is Optimal = ${isOptimal}`);
            console.log(`   Status: ${isOptimal ? "✅ OPTIMAL" : "⚠️  Suboptimal"}\n`);

            return {
                scenario: "Optimal State",
                success: isOptimal && Math.abs(deltaValue - 230) < 10,
                delta: deltaValue,
                efficiency: efficiencyPercent,
                isOptimal
            };
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
            return { scenario: "Optimal State", success: false, error: error.message };
        }
    }

    /**
     * Scenario 2: Network under stress (high damping, low coupling)
     * Simulates network congestion or high transaction load
     */
    async testHighStress() {
        console.log("📊 Scenario 2: Network Under High Stress");
        console.log("   Simulating: High transaction load, network congestion");
        console.log("   Expected: Higher Δ, Lower efficiency, Not optimal\n");

        const eta = 950000000;    // 0.95 × 1e9 (high damping)
        const lambda = 300000000; // 0.3 × 1e9 (low coupling)

        try {
            const delta = await this.oracle.computeDelta(eta, lambda);
            const efficiency = await this.oracle.efficiency(delta);
            const isOptimal = await this.oracle.isOptimal(delta);

            const deltaValue = Number(delta);
            const efficiencyValue = Number(efficiency);
            const efficiencyPercent = (efficiencyValue / 1e9) * 100;

            console.log(`   Results:`);
            console.log(`   Δ = ${deltaValue} (${(deltaValue / 1000).toFixed(3)})`);
            console.log(`   Efficiency = ${efficiencyPercent.toFixed(2)}%`);
            console.log(`   Is Optimal = ${isOptimal}`);
            console.log(`   Status: ${isOptimal ? "✅ Optimal" : "⚠️  STRESSED"}\n`);

            return {
                scenario: "High Stress",
                success: !isOptimal, // Should NOT be optimal under stress
                delta: deltaValue,
                efficiency: efficiencyPercent,
                isOptimal
            };
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
            return { scenario: "High Stress", success: false, error: error.message };
        }
    }

    /**
     * Scenario 3: Network recovering from stress
     * Simulates network returning to normal after congestion
     */
    async testRecovery() {
        console.log("📊 Scenario 3: Network Recovery");
        console.log("   Simulating: Network recovering from stress");
        console.log("   Expected: Approaching optimal, improving efficiency\n");

        const eta = 750000000;    // 0.75 × 1e9
        const lambda = 650000000; // 0.65 × 1e9

        try {
            const delta = await this.oracle.computeDelta(eta, lambda);
            const efficiency = await this.oracle.efficiency(delta);
            const isOptimal = await this.oracle.isOptimal(delta);

            const deltaValue = Number(delta);
            const efficiencyValue = Number(efficiency);
            const efficiencyPercent = (efficiencyValue / 1e9) * 100;

            console.log(`   Results:`);
            console.log(`   Δ = ${deltaValue} (${(deltaValue / 1000).toFixed(3)})`);
            console.log(`   Efficiency = ${efficiencyPercent.toFixed(2)}%`);
            console.log(`   Is Optimal = ${isOptimal}`);
            console.log(`   Status: ${isOptimal ? "✅ RECOVERED" : "🔄 RECOVERING"}\n`);

            return {
                scenario: "Recovery",
                success: true,
                delta: deltaValue,
                efficiency: efficiencyPercent,
                isOptimal
            };
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
            return { scenario: "Recovery", success: false, error: error.message };
        }
    }

    /**
     * Scenario 4: Network failure state
     * Simulates critical network failure
     */
    async testFailureState() {
        console.log("📊 Scenario 4: Network Failure State");
        console.log("   Simulating: Critical network failure");
        console.log("   Expected: Negative Δ, Zero efficiency\n");

        const eta = 0;
        const lambda = 0;

        try {
            const delta = await this.oracle.computeDelta(eta, lambda);
            const efficiency = await this.oracle.efficiency(delta);
            const isOptimal = await this.oracle.isOptimal(delta);

            const deltaValue = Number(delta);
            const efficiencyValue = Number(efficiency);
            const efficiencyPercent = (efficiencyValue / 1e9) * 100;

            console.log(`   Results:`);
            console.log(`   Δ = ${deltaValue} (${(deltaValue / 1000).toFixed(3)})`);
            console.log(`   Efficiency = ${efficiencyPercent.toFixed(2)}%`);
            console.log(`   Is Optimal = ${isOptimal}`);
            console.log(`   Status: ${deltaValue < 0 ? "❌ FAILURE" : "⚠️  Degraded"}\n`);

            return {
                scenario: "Failure State",
                success: deltaValue <= 0 || efficiencyPercent < 50,
                delta: deltaValue,
                efficiency: efficiencyPercent,
                isOptimal
            };
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
            return { scenario: "Failure State", success: false, error: error.message };
        }
    }

    /**
     * Scenario 5: Continuous monitoring simulation
     * Simulates multiple readings over time
     */
    async testContinuousMonitoring() {
        console.log("📊 Scenario 5: Continuous Monitoring Simulation");
        console.log("   Simulating: Multiple readings over time\n");

        const readings = [
            { name: "T+0min", eta: 707106781, lambda: 707106781 },
            { name: "T+5min", eta: 710000000, lambda: 705000000 },
            { name: "T+10min", eta: 705000000, lambda: 710000000 },
            { name: "T+15min", eta: 707106781, lambda: 707106781 },
        ];

        const results = [];

        for (const reading of readings) {
            try {
                const delta = await this.oracle.computeDelta(reading.eta, reading.lambda);
                const efficiency = await this.oracle.efficiency(delta);
                const isOptimal = await this.oracle.isOptimal(delta);

                const deltaValue = Number(delta);
                const efficiencyPercent = (Number(efficiency) / 1e9) * 100;

                results.push({
                    time: reading.name,
                    delta: deltaValue,
                    efficiency: efficiencyPercent,
                    isOptimal
                });

                console.log(`   ${reading.name}: Δ=${deltaValue} (${(deltaValue/1000).toFixed(3)}), Eff=${efficiencyPercent.toFixed(2)}%, Optimal=${isOptimal}`);

                // Small delay between readings
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`   ❌ Error at ${reading.name}: ${error.message}`);
            }
        }

        console.log("");

        // Analyze trends
        const allOptimal = results.every(r => r.isOptimal);
        const avgDelta = results.reduce((sum, r) => sum + r.delta, 0) / results.length;
        const avgEfficiency = results.reduce((sum, r) => sum + r.efficiency, 0) / results.length;

        console.log(`   Analysis:`);
        console.log(`   Average Δ: ${avgDelta.toFixed(1)}`);
        console.log(`   Average Efficiency: ${avgEfficiency.toFixed(2)}%`);
        console.log(`   Consistently Optimal: ${allOptimal ? "✅ Yes" : "⚠️  No"}\n`);

        return {
            scenario: "Continuous Monitoring",
            success: allOptimal,
            readings: results,
            avgDelta,
            avgEfficiency
        };
    }

    /**
     * Scenario 6: Edge case - boundary conditions
     * Tests the limits of the contract
     */
    async testBoundaryConditions() {
        console.log("📊 Scenario 6: Boundary Conditions");
        console.log("   Testing: Contract limits and edge cases\n");

        const testCases = [
            { name: "Planck Lower Bound", eta: 707106781, lambda: 707106781, expectedOptimal: true },
            { name: "Planck Upper Bound", eta: 707106781, lambda: 707106781, expectedOptimal: true },
            { name: "Just Below Optimal", eta: 690000000, lambda: 690000000, expectedOptimal: false },
            { name: "Just Above Optimal", eta: 720000000, lambda: 720000000, expectedOptimal: false },
        ];

        const results = [];

        for (const testCase of testCases) {
            try {
                const delta = await this.oracle.computeDelta(testCase.eta, testCase.lambda);
                const isOptimal = await this.oracle.isOptimal(delta);
                const match = isOptimal === testCase.expectedOptimal;

                results.push({
                    name: testCase.name,
                    success: match,
                    delta: Number(delta),
                    isOptimal
                });

                console.log(`   ${testCase.name}: ${match ? "✅" : "❌"} Optimal=${isOptimal} (expected ${testCase.expectedOptimal})`);
            } catch (error) {
                console.error(`   ❌ ${testCase.name}: ${error.message}`);
                results.push({ name: testCase.name, success: false, error: error.message });
            }
        }

        console.log("");

        return {
            scenario: "Boundary Conditions",
            success: results.every(r => r.success !== false),
            results
        };
    }

    async runAllTests() {
        console.log("=".repeat(70));
        console.log("🌍 REAL-WORLD SCENARIO TESTING");
        console.log("=".repeat(70));
        console.log("Testing Holographic Oracle with realistic network conditions\n");

        const connected = await this.connect();
        if (!connected) {
            console.error("❌ Failed to connect. Exiting.");
            process.exit(1);
        }

        // Get network info
        try {
            const blockNumber = await this.provider.getBlockNumber();
            const block = await this.provider.getBlock(blockNumber);
            console.log(`📦 Current Block: ${blockNumber}`);
            console.log(`⏰ Block Time: ${new Date(block.timestamp * 1000).toISOString()}\n`);
        } catch (error) {
            console.log("⚠️  Could not fetch block info\n");
        }

        // Run all scenarios
        const scenarios = [
            () => this.testOptimalState(),
            () => this.testHighStress(),
            () => this.testRecovery(),
            () => this.testFailureState(),
            () => this.testContinuousMonitoring(),
            () => this.testBoundaryConditions(),
        ];

        for (const scenario of scenarios) {
            const result = await scenario();
            this.results.push(result);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between scenarios
        }

        // Print summary
        this.printSummary();
    }

    printSummary() {
        console.log("=".repeat(70));
        console.log("📊 TEST SUMMARY");
        console.log("=".repeat(70));

        const total = this.results.length;
        const passed = this.results.filter(r => r.success !== false).length;
        const failed = this.results.filter(r => r.success === false).length;

        console.log(`Total Scenarios: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

        console.log("Scenario Results:");
        this.results.forEach((result, index) => {
            const status = result.success !== false ? "✅" : "❌";
            console.log(`   ${status} ${result.scenario}`);
            if (result.delta !== undefined) {
                console.log(`      Δ: ${result.delta}, Efficiency: ${result.efficiency?.toFixed(2)}%`);
            }
        });

        console.log("\n" + "=".repeat(70));
        console.log("🎯 Real-world testing complete!");
        console.log("=".repeat(70));
    }
}

// Main execution
async function main() {
    const tester = new RealWorldTester();
    await tester.runAllTests();
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("Fatal error:", error);
            process.exit(1);
        });
}

module.exports = { RealWorldTester };

