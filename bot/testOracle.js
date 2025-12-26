const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const contractABI = require("./contractABI.json");

// Contract address on Polygon Amoy
const CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE";
const RPC_URL = process.env.AMOY_RPC_URL || process.env.RPC_URL || "https://rpc-amoy.polygon.technology";

// Test scenarios
const TEST_SCENARIOS = [
    {
        name: "Critical Damping (Optimal)",
        eta: 707106781,    // 1/√2 × 1e9
        lambda: 707106781, // 1/√2 × 1e9
        expectedDelta: 230, // ±5 tolerance
        expectedOptimal: true,
    },
    {
        name: "Origin (Zero State)",
        eta: 0,
        lambda: 0,
        expectedDelta: null, // Contract calculates normally (Δ = 0)
        expectedOptimal: false,
    },
    {
        name: "High Damping",
        eta: 900000000,    // 0.9 × 1e9
        lambda: 400000000, // 0.4 × 1e9
        expectedDelta: null, // Don't check exact value
        expectedOptimal: false,
    },
    {
        name: "Low Damping",
        eta: 400000000,    // 0.4 × 1e9
        lambda: 900000000, // 0.9 × 1e9
        expectedDelta: null,
        expectedOptimal: false,
    },
    {
        name: "Balanced (Near Optimal)",
        eta: 700000000,    // 0.7 × 1e9
        lambda: 700000000, // 0.7 × 1e9
        expectedDelta: null,
        expectedOptimal: null, // May or may not be optimal
    },
];

class OracleTester {
    constructor() {
        this.oracle = null;
        this.results = [];
        this.provider = null;
    }

    async connect() {
        console.log("🔗 Connecting to HolographicOracle contract...");
        console.log("📍 Address:", CONTRACT_ADDRESS);
        console.log("🌐 Network:", process.env.NETWORK || "amoy");
        console.log("🔗 RPC URL:", RPC_URL);
        console.log("");

        try {
            // Create provider
            this.provider = new ethers.JsonRpcProvider(RPC_URL);
            
            // Create contract instance
            this.oracle = new ethers.Contract(CONTRACT_ADDRESS, contractABI, this.provider);
            
            // Verify connection by checking if contract exists
            const code = await this.provider.getCode(CONTRACT_ADDRESS);
            if (code === "0x") {
                throw new Error("Contract not found at address");
            }
            
            console.log("✅ Connected to contract!");
            return true;
        } catch (error) {
            console.error("❌ Failed to connect:", error.message);
            return false;
        }
    }

    async testScenario(scenario) {
        console.log(`\n🧪 Testing: ${scenario.name}`);
        console.log(`   η = ${scenario.eta} (${scenario.eta / 1e9})`);
        console.log(`   λ = ${scenario.lambda} (${scenario.lambda / 1e9})`);

        try {
            // Test computeDelta
            const delta = await this.oracle.computeDelta(scenario.eta, scenario.lambda);
            const deltaValue = Number(delta);
            const deltaDecimal = deltaValue / 1000;

            console.log(`   📊 Δ = ${deltaValue} (${deltaDecimal.toFixed(3)})`);

            // Test efficiency
            const efficiency = await this.oracle.efficiency(delta);
            const efficiencyValue = Number(efficiency);
            const efficiencyPercent = (efficiencyValue / 1e9) * 100;

            console.log(`   ⚡ Efficiency = ${efficiencyValue} (${efficiencyPercent.toFixed(2)}%)`);

            // Test isOptimal
            const isOptimal = await this.oracle.isOptimal(delta);
            console.log(`   🔬 Is Optimal = ${isOptimal}`);

            // Validate results
            const validation = this.validateResults(scenario, deltaValue, isOptimal, efficiencyValue);
            
            const result = {
                scenario: scenario.name,
                success: validation.success,
                delta: deltaValue,
                deltaDecimal: deltaDecimal,
                efficiency: efficiencyValue,
                efficiencyPercent: efficiencyPercent,
                isOptimal: isOptimal,
                validation: validation,
            };

            this.results.push(result);

            if (validation.success) {
                console.log(`   ✅ Test passed`);
            } else {
                console.log(`   ⚠️  Test warning: ${validation.message}`);
            }

            return result;
        } catch (error) {
            console.error(`   ❌ Test failed:`, error.message);
            const result = {
                scenario: scenario.name,
                success: false,
                error: error.message,
            };
            this.results.push(result);
            return result;
        }
    }

    validateResults(scenario, delta, isOptimal, efficiencyValue) {
        const issues = [];

        // Check delta if expected
        if (scenario.expectedDelta !== null) {
            const tolerance = 5; // ±5 in scaled units
            const diff = Math.abs(delta - scenario.expectedDelta);
            if (diff > tolerance) {
                issues.push(`Delta ${delta} differs from expected ${scenario.expectedDelta} by ${diff}`);
            }
        }

        // Check optimal status if expected
        if (scenario.expectedOptimal !== null && isOptimal !== scenario.expectedOptimal) {
            issues.push(`Optimal status ${isOptimal} differs from expected ${scenario.expectedOptimal}`);
        }

        // Check efficiency is reasonable (0-100%)
        if (efficiencyValue !== undefined) {
            const efficiencyPercent = (efficiencyValue / 1e9) * 100;
            if (efficiencyPercent < 0 || efficiencyPercent > 100) {
                issues.push(`Efficiency ${efficiencyPercent}% is out of valid range [0, 100]`);
            }
        }

        return {
            success: issues.length === 0,
            message: issues.length > 0 ? issues.join("; ") : "All checks passed",
        };
    }

    async testInputValidation() {
        console.log("\n🛡️  Testing Input Validation...");

        const testCases = [
            {
                name: "Valid input",
                eta: 707106781,
                lambda: 707106781,
                shouldPass: true,
            },
            {
                name: "Input too large",
                eta: 2e18,
                lambda: 707106781,
                shouldPass: false,
            },
            {
                name: "Input too small",
                eta: -2e18,
                lambda: 707106781,
                shouldPass: false,
            },
        ];

        for (const testCase of testCases) {
            try {
                await this.oracle.computeDelta(testCase.eta, testCase.lambda);
                if (!testCase.shouldPass) {
                    console.log(`   ❌ ${testCase.name}: Should have failed but didn't`);
                } else {
                    console.log(`   ✅ ${testCase.name}: Passed`);
                }
            } catch (error) {
                if (testCase.shouldPass) {
                    console.log(`   ❌ ${testCase.name}: Should have passed but failed: ${error.message}`);
                } else {
                    console.log(`   ✅ ${testCase.name}: Correctly rejected (${error.message})`);
                }
            }
        }
    }

    async testEdgeCases() {
        console.log("\n🔬 Testing Edge Cases...");

        const edgeCases = [
            {
                name: "Delta = -1000 (failure threshold)",
                delta: -1000,
                expectedEfficiency: 0,
            },
            {
                name: "Delta = -1001 (below threshold)",
                delta: -1001,
                expectedEfficiency: 0,
            },
            {
                name: "Delta = 228 (Planck low)",
                delta: 228,
                expectedOptimal: true,
            },
            {
                name: "Delta = 234 (Planck high)",
                delta: 234,
                expectedOptimal: true,
            },
            {
                name: "Delta = 227 (below optimal)",
                delta: 227,
                expectedOptimal: false,
            },
            {
                name: "Delta = 235 (above optimal)",
                delta: 235,
                expectedOptimal: false,
            },
        ];

        for (const testCase of edgeCases) {
            try {
                if (testCase.expectedEfficiency !== undefined) {
                    const efficiency = await this.oracle.efficiency(testCase.delta);
                    const match = Number(efficiency) === testCase.expectedEfficiency;
                    console.log(`   ${match ? "✅" : "❌"} ${testCase.name}: Efficiency = ${efficiency} (expected ${testCase.expectedEfficiency})`);
                }
                if (testCase.expectedOptimal !== undefined) {
                    const isOptimal = await this.oracle.isOptimal(testCase.delta);
                    const match = isOptimal === testCase.expectedOptimal;
                    console.log(`   ${match ? "✅" : "❌"} ${testCase.name}: IsOptimal = ${isOptimal} (expected ${testCase.expectedOptimal})`);
                }
            } catch (error) {
                console.log(`   ❌ ${testCase.name}: Error - ${error.message}`);
            }
        }
    }

    printSummary() {
        console.log("\n" + "=".repeat(60));
        console.log("📊 TEST SUMMARY");
        console.log("=".repeat(60));

        const total = this.results.length;
        const passed = this.results.filter(r => r.success !== false).length;
        const failed = this.results.filter(r => r.success === false).length;

        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log("\n❌ Failed Tests:");
            this.results
                .filter(r => r.success === false)
                .forEach(r => {
                    console.log(`   - ${r.scenario}: ${r.error || r.validation?.message}`);
                });
        }

        console.log("\n" + "=".repeat(60));

        // Write results to files for CI/CD
        this.writeResultsToFiles(total, passed, failed);
    }

    writeResultsToFiles(total, passed, failed) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsDir = path.join(__dirname);
        
        // Create summary object
        const summary = {
            timestamp: new Date().toISOString(),
            total,
            passed,
            failed,
            successRate: ((passed / total) * 100).toFixed(1),
            results: this.results
        };

        // Write JSON file
        const jsonFile = path.join(resultsDir, `test-results-${timestamp}.json`);
        try {
            fs.writeFileSync(jsonFile, JSON.stringify(summary, null, 2));
            console.log(`\n📄 Results written to: ${jsonFile}`);
        } catch (error) {
            console.error(`\n⚠️  Failed to write JSON results: ${error.message}`);
        }

        // Write text file
        const txtFile = path.join(resultsDir, `test-results-${timestamp}.txt`);
        try {
            let textContent = "=".repeat(60) + "\n";
            textContent += "ORACLE CONTRACT TEST RESULTS\n";
            textContent += "=".repeat(60) + "\n\n";
            textContent += `Timestamp: ${summary.timestamp}\n`;
            textContent += `Total Tests: ${total}\n`;
            textContent += `✅ Passed: ${passed}\n`;
            textContent += `❌ Failed: ${failed}\n`;
            textContent += `Success Rate: ${summary.successRate}%\n\n`;

            if (failed > 0) {
                textContent += "Failed Tests:\n";
                this.results
                    .filter(r => r.success === false)
                    .forEach(r => {
                        textContent += `  - ${r.scenario}: ${r.error || r.validation?.message}\n`;
                    });
                textContent += "\n";
            }

            textContent += "Detailed Results:\n";
            this.results.forEach((result, index) => {
                textContent += `\n${index + 1}. ${result.scenario}\n`;
                if (result.delta !== undefined) {
                    textContent += `   Δ: ${result.delta}\n`;
                }
                if (result.efficiencyPercent !== undefined) {
                    textContent += `   Efficiency: ${result.efficiencyPercent.toFixed(2)}%\n`;
                }
                if (result.isOptimal !== undefined) {
                    textContent += `   Is Optimal: ${result.isOptimal}\n`;
                }
                if (result.success === false) {
                    textContent += `   Status: ❌ FAILED\n`;
                    if (result.error) {
                        textContent += `   Error: ${result.error}\n`;
                    }
                } else {
                    textContent += `   Status: ✅ PASSED\n`;
                }
            });

            fs.writeFileSync(txtFile, textContent);
            console.log(`📄 Results written to: ${txtFile}`);
        } catch (error) {
            console.error(`\n⚠️  Failed to write text results: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log("🤖 Starting Holographic Oracle Test Bot");
        console.log("=".repeat(60));

        const connected = await this.connect();
        if (!connected) {
            console.error("❌ Failed to connect to contract. Exiting.");
            process.exit(1);
        }

        // Run test scenarios
        console.log("\n📋 Running Test Scenarios...");
        for (const scenario of TEST_SCENARIOS) {
            await this.testScenario(scenario);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Test input validation
        await this.testInputValidation();

        // Test edge cases
        await this.testEdgeCases();

        // Print summary
        this.printSummary();
    }
}

// Main execution
async function main() {
    const tester = new OracleTester();
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

module.exports = { OracleTester, TEST_SCENARIOS };

