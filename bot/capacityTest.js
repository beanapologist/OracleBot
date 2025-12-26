const { ethers } = require("ethers");
require("dotenv").config();
const contractABI = require("./contractABI.json");

const CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE";
const RPC_URL = process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology";

/**
 * Full Capacity Testing Suite
 * Tests the contract's limits, performance, and edge cases
 */
class CapacityTester {
    constructor() {
        this.provider = null;
        this.oracle = null;
        this.results = [];
        this.gasResults = [];
    }

    async connect() {
        console.log("🔗 Connecting to Polygon Amoy Testnet...");
        try {
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            this.oracle = new ethers.Contract(CONTRACT_ADDRESS, contractABI, this.provider);
            
            const code = await this.provider.getCode(CONTRACT_ADDRESS);
            if (code === "0x") throw new Error("Contract not found");
            
            console.log("✅ Connected!\n");
            return true;
        } catch (error) {
            console.error("❌ Connection failed:", error.message);
            return false;
        }
    }

    /**
     * Test 1: Input Range Limits
     * Tests the contract's input validation boundaries
     */
    async testInputRangeLimits() {
        console.log("📊 Test 1: Input Range Limits");
        console.log("   Testing: Contract's input validation boundaries\n");

        const testCases = [
            { name: "Maximum valid input", eta: 1e18, lambda: 1e18, shouldPass: true },
            { name: "Minimum valid input", eta: -1e18, lambda: -1e18, shouldPass: true },
            { name: "Just above max", eta: 1e18 + 1, lambda: 1e18, shouldPass: false },
            { name: "Just below min", eta: -1e18 - 1, lambda: -1e18, shouldPass: false },
            { name: "Very large positive", eta: 1e19, lambda: 1e18, shouldPass: false },
            { name: "Very large negative", eta: -1e19, lambda: -1e18, shouldPass: false },
        ];

        let passed = 0;
        let failed = 0;

        for (const testCase of testCases) {
            try {
                await this.oracle.computeDelta(testCase.eta, testCase.lambda);
                if (testCase.shouldPass) {
                    console.log(`   ✅ ${testCase.name}: Accepted (expected)`);
                    passed++;
                } else {
                    console.log(`   ❌ ${testCase.name}: Accepted (should have rejected)`);
                    failed++;
                }
            } catch (error) {
                if (!testCase.shouldPass) {
                    console.log(`   ✅ ${testCase.name}: Rejected (expected)`);
                    passed++;
                } else {
                    console.log(`   ❌ ${testCase.name}: Rejected (should have accepted)`);
                    failed++;
                }
            }
        }

        console.log(`\n   Results: ${passed} passed, ${failed} failed\n`);
        return { test: "Input Range Limits", passed, failed, success: failed === 0 };
    }

    /**
     * Test 2: Precision Testing
     * Tests mathematical precision with various input values
     */
    async testPrecision() {
        console.log("📊 Test 2: Precision Testing");
        console.log("   Testing: Mathematical precision and rounding\n");

        const precisionTests = [
            { name: "Critical damping (exact)", eta: 707106781, lambda: 707106781, expectedDelta: 230, tolerance: 5 },
            { name: "Small values", eta: 1000000, lambda: 1000000, expectedDelta: null },
            { name: "Large values", eta: 900000000, lambda: 900000000, expectedDelta: null },
            { name: "Mixed signs", eta: 500000000, lambda: -500000000, expectedDelta: null },
            { name: "Asymmetric", eta: 707106781, lambda: 500000000, expectedDelta: null },
        ];

        let passed = 0;
        const results = [];

        for (const test of precisionTests) {
            try {
                const delta = await this.oracle.computeDelta(test.eta, test.lambda);
                const deltaValue = Number(delta);
                
                let match = true;
                if (test.expectedDelta !== null) {
                    const diff = Math.abs(deltaValue - test.expectedDelta);
                    match = diff <= test.tolerance;
                }

                results.push({
                    name: test.name,
                    delta: deltaValue,
                    match
                });

                if (match) {
                    console.log(`   ✅ ${test.name}: Δ = ${deltaValue}`);
                    passed++;
                } else {
                    console.log(`   ⚠️  ${test.name}: Δ = ${deltaValue} (expected ~${test.expectedDelta})`);
                }
            } catch (error) {
                console.log(`   ❌ ${test.name}: Error - ${error.message}`);
            }
        }

        console.log(`\n   Results: ${passed}/${precisionTests.length} passed\n`);
        return { test: "Precision", passed, total: precisionTests.length, results };
    }

    /**
     * Test 3: Gas Usage Analysis
     * Measures gas consumption for different operations
     */
    async testGasUsage() {
        console.log("📊 Test 3: Gas Usage Analysis");
        console.log("   Testing: Gas consumption for different operations\n");

        // Note: On testnet, we can't get actual gas used without sending transactions
        // But we can estimate gas costs
        const testCases = [
            { name: "Optimal state", eta: 707106781, lambda: 707106781 },
            { name: "Edge case", eta: 1e18, lambda: 1e18 },
            { name: "Zero state", eta: 0, lambda: 0 },
            { name: "Large values", eta: 900000000, lambda: 900000000 },
        ];

        const gasEstimates = [];

        for (const testCase of testCases) {
            try {
                // Estimate gas (this is a read operation, so gas is minimal)
                // For write operations, we'd need a signer
                const startTime = Date.now();
                const delta = await this.oracle.computeDelta(testCase.eta, testCase.lambda);
                const efficiency = await this.oracle.efficiency(delta);
                const isOptimal = await this.oracle.isOptimal(delta);
                const endTime = Date.now();

                const latency = endTime - startTime;
                gasEstimates.push({
                    name: testCase.name,
                    latency: `${latency}ms`,
                    delta: Number(delta)
                });

                console.log(`   ✅ ${testCase.name}: ${latency}ms latency`);
            } catch (error) {
                console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
            }
        }

        const avgLatency = gasEstimates.reduce((sum, g) => sum + parseInt(g.latency), 0) / gasEstimates.length;
        console.log(`\n   Average latency: ${avgLatency.toFixed(2)}ms\n`);

        return { test: "Gas Usage", gasEstimates, avgLatency };
    }

    /**
     * Test 4: Concurrent Calls
     * Tests contract behavior under concurrent load
     */
    async testConcurrentCalls() {
        console.log("📊 Test 4: Concurrent Calls");
        console.log("   Testing: Contract behavior under concurrent load\n");

        const concurrentCount = 10;
        const testInput = { eta: 707106781, lambda: 707106781 };

        console.log(`   Making ${concurrentCount} concurrent calls...`);

        const startTime = Date.now();
        const promises = Array(concurrentCount).fill(null).map(async (_, index) => {
            try {
                const delta = await this.oracle.computeDelta(testInput.eta, testInput.lambda);
                return { index, success: true, delta: Number(delta) };
            } catch (error) {
                return { index, success: false, error: error.message };
            }
        });

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        // Check consistency
        const deltas = results.filter(r => r.success).map(r => r.delta);
        const allSame = deltas.every(d => d === deltas[0]);

        console.log(`   Results:`);
        console.log(`   Successful: ${successful}/${concurrentCount}`);
        console.log(`   Failed: ${failed}/${concurrentCount}`);
        console.log(`   Total time: ${totalTime}ms`);
        console.log(`   Average per call: ${(totalTime / concurrentCount).toFixed(2)}ms`);
        console.log(`   Consistent results: ${allSame ? "✅ Yes" : "❌ No"}`);
        if (allSame && deltas.length > 0) {
            console.log(`   All returned: Δ = ${deltas[0]}`);
        }
        console.log("");

        return {
            test: "Concurrent Calls",
            successful,
            failed,
            totalTime,
            consistent: allSame,
            success: successful === concurrentCount && allSame
        };
    }

    /**
     * Test 5: Stress Test - Many Sequential Calls
     * Tests contract performance with many sequential operations
     */
    async testStressSequential() {
        console.log("📊 Test 5: Stress Test - Sequential Calls");
        console.log("   Testing: Performance with many sequential operations\n");

        const callCount = 50;
        const testInput = { eta: 707106781, lambda: 707106781 };

        console.log(`   Making ${callCount} sequential calls...`);

        const startTime = Date.now();
        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < callCount; i++) {
            try {
                const delta = await this.oracle.computeDelta(testInput.eta, testInput.lambda);
                results.push({ call: i + 1, success: true, delta: Number(delta) });
                successCount++;
            } catch (error) {
                results.push({ call: i + 1, success: false, error: error.message });
                failCount++;
            }
            
            // Small delay to avoid rate limiting
            if (i % 10 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / callCount;

        console.log(`   Results:`);
        console.log(`   Successful: ${successCount}/${callCount}`);
        console.log(`   Failed: ${failCount}/${callCount}`);
        console.log(`   Total time: ${totalTime}ms`);
        console.log(`   Average per call: ${avgTime.toFixed(2)}ms`);
        console.log(`   Throughput: ${(callCount / (totalTime / 1000)).toFixed(2)} calls/second`);
        console.log("");

        return {
            test: "Stress Sequential",
            successful: successCount,
            failed: failCount,
            totalTime,
            avgTime,
            throughput: callCount / (totalTime / 1000),
            success: failCount === 0
        };
    }

    /**
     * Test 6: Edge Case Combinations
     * Tests various edge case combinations
     */
    async testEdgeCaseCombinations() {
        console.log("📊 Test 6: Edge Case Combinations");
        console.log("   Testing: Various edge case combinations\n");

        const edgeCases = [
            { name: "Max positive values", eta: 1e18, lambda: 1e18 },
            { name: "Max negative values", eta: -1e18, lambda: -1e18 },
            { name: "Mixed max", eta: 1e18, lambda: -1e18 },
            { name: "Near zero positive", eta: 1, lambda: 1 },
            { name: "Near zero negative", eta: -1, lambda: -1 },
            { name: "Asymmetric large", eta: 1e18, lambda: 1 },
            { name: "Asymmetric small", eta: 1, lambda: 1e18 },
        ];

        let passed = 0;
        const results = [];

        for (const testCase of edgeCases) {
            try {
                const delta = await this.oracle.computeDelta(testCase.eta, testCase.lambda);
                const efficiency = await this.oracle.efficiency(delta);
                const isOptimal = await this.oracle.isOptimal(delta);

                const deltaValue = Number(delta);
                const efficiencyValue = Number(efficiency);
                const efficiencyPercent = (efficiencyValue / 1e9) * 100;

                // Validate results are reasonable
                const isValid = !isNaN(deltaValue) && 
                               !isNaN(efficiencyPercent) && 
                               efficiencyPercent >= 0 && 
                               efficiencyPercent <= 100;

                results.push({
                    name: testCase.name,
                    delta: deltaValue,
                    efficiency: efficiencyPercent,
                    isValid
                });

                if (isValid) {
                    console.log(`   ✅ ${testCase.name}: Δ=${deltaValue}, Eff=${efficiencyPercent.toFixed(2)}%`);
                    passed++;
                } else {
                    console.log(`   ❌ ${testCase.name}: Invalid results`);
                }
            } catch (error) {
                console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
            }
        }

        console.log(`\n   Results: ${passed}/${edgeCases.length} passed\n`);
        return { test: "Edge Case Combinations", passed, total: edgeCases.length, results };
    }

    /**
     * Test 7: Function Call Combinations
     * Tests all function combinations
     */
    async testFunctionCombinations() {
        console.log("📊 Test 7: Function Call Combinations");
        console.log("   Testing: All function combinations\n");

        const testInput = { eta: 707106781, lambda: 707106781 };
        let passed = 0;
        let failed = 0;

        try {
            // Test computeDelta
            const delta = await this.oracle.computeDelta(testInput.eta, testInput.lambda);
            console.log(`   ✅ computeDelta: Δ = ${Number(delta)}`);
            passed++;

            // Test efficiency with computed delta
            const efficiency = await this.oracle.efficiency(delta);
            console.log(`   ✅ efficiency: ${(Number(efficiency) / 1e9 * 100).toFixed(2)}%`);
            passed++;

            // Test isOptimal with computed delta
            const isOptimal = await this.oracle.isOptimal(delta);
            console.log(`   ✅ isOptimal: ${isOptimal}`);
            passed++;

            // Test efficiency with edge values
            const eff1 = await this.oracle.efficiency(230);
            const eff2 = await this.oracle.efficiency(-1000);
            const eff3 = await this.oracle.efficiency(1000);
            console.log(`   ✅ efficiency edge cases: ${Number(eff1)}, ${Number(eff2)}, ${Number(eff3)}`);
            passed++;

            // Test isOptimal with edge values
            const opt1 = await this.oracle.isOptimal(228);
            const opt2 = await this.oracle.isOptimal(234);
            const opt3 = await this.oracle.isOptimal(227);
            const opt4 = await this.oracle.isOptimal(235);
            console.log(`   ✅ isOptimal edge cases: ${opt1}, ${opt2}, ${opt3}, ${opt4}`);
            passed++;

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            failed++;
        }

        console.log(`\n   Results: ${passed} passed, ${failed} failed\n`);
        return { test: "Function Combinations", passed, failed, success: failed === 0 };
    }

    /**
     * Test 8: Delta Range Testing
     * Tests efficiency and isOptimal across full delta range
     */
    async testDeltaRange() {
        console.log("📊 Test 8: Delta Range Testing");
        console.log("   Testing: Efficiency and optimal checks across delta range\n");

        const deltaValues = [
            -2000, -1500, -1000, -500, -100, 0, 100, 200, 228, 230, 234, 250, 500, 1000, 2000
        ];

        const results = [];
        let passed = 0;

        for (const delta of deltaValues) {
            try {
                const efficiency = await this.oracle.efficiency(delta);
                const isOptimal = await this.oracle.isOptimal(delta);
                const effPercent = (Number(efficiency) / 1e9 * 100);

                results.push({
                    delta,
                    efficiency: effPercent,
                    isOptimal,
                    valid: effPercent >= 0 && effPercent <= 100
                });

                if (effPercent >= 0 && effPercent <= 100) {
                    passed++;
                }
            } catch (error) {
                console.log(`   ❌ Delta ${delta}: Error - ${error.message}`);
            }
        }

        // Print key results
        console.log(`   Key results:`);
        results.forEach(r => {
            if (r.delta === -1000 || r.delta === 228 || r.delta === 230 || r.delta === 234) {
                console.log(`   Δ=${r.delta}: Eff=${r.efficiency.toFixed(2)}%, Optimal=${r.isOptimal}`);
            }
        });

        console.log(`\n   Results: ${passed}/${deltaValues.length} valid\n`);
        return { test: "Delta Range", passed, total: deltaValues.length, results };
    }

    async runAllTests() {
        console.log("=".repeat(70));
        console.log("🚀 FULL CAPACITY TESTING SUITE");
        console.log("=".repeat(70));
        console.log("Testing contract limits, performance, and edge cases\n");

        const connected = await this.connect();
        if (!connected) {
            console.error("❌ Failed to connect. Exiting.");
            process.exit(1);
        }

        // Run all capacity tests
        const tests = [
            () => this.testInputRangeLimits(),
            () => this.testPrecision(),
            () => this.testGasUsage(),
            () => this.testConcurrentCalls(),
            () => this.testStressSequential(),
            () => this.testEdgeCaseCombinations(),
            () => this.testFunctionCombinations(),
            () => this.testDeltaRange(),
        ];

        for (const test of tests) {
            const result = await test();
            this.results.push(result);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.printSummary();
    }

    printSummary() {
        console.log("=".repeat(70));
        console.log("📊 CAPACITY TEST SUMMARY");
        console.log("=".repeat(70));

        const total = this.results.length;
        const passed = this.results.filter(r => r.success !== false).length;
        const failed = this.results.filter(r => r.success === false).length;

        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

        console.log("Test Details:");
        this.results.forEach(result => {
            const status = result.success !== false ? "✅" : "❌";
            console.log(`   ${status} ${result.test}`);
            if (result.throughput) {
                console.log(`      Throughput: ${result.throughput.toFixed(2)} calls/sec`);
            }
            if (result.avgTime) {
                console.log(`      Avg latency: ${result.avgTime.toFixed(2)}ms`);
            }
        });

        console.log("\n" + "=".repeat(70));
        console.log("🎯 Capacity testing complete!");
        console.log("=".repeat(70));
    }
}

// Main execution
async function main() {
    const tester = new CapacityTester();
    await tester.runAllTests();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("Fatal error:", error);
            process.exit(1);
        });
}

module.exports = { CapacityTester };

