const { OracleTester } = require("./testOracle");
require("dotenv").config();

/**
 * Continuous monitoring bot for Holographic Oracle
 * Runs tests periodically and reports results
 */
class OracleMonitor {
    constructor(intervalMinutes = 5) {
        this.intervalMinutes = intervalMinutes;
        this.isRunning = false;
        this.runCount = 0;
        this.startTime = Date.now();
    }

    async runSingleTest() {
        const tester = new OracleTester();
        const connected = await tester.connect();
        
        if (!connected) {
            console.error("❌ Failed to connect. Will retry on next cycle.");
            return false;
        }

        // Test critical damping scenario
        const criticalDamping = {
            name: "Critical Damping (Health Check)",
            eta: 707106781,
            lambda: 707106781,
            expectedDelta: 230,
            expectedOptimal: true,
        };

        const result = await tester.testScenario(criticalDamping);
        
        // Log result
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] Health Check Result:`);
        console.log(`   Δ = ${result.delta} (${result.deltaDecimal?.toFixed(3)})`);
        console.log(`   Efficiency = ${result.efficiencyPercent?.toFixed(2)}%`);
        console.log(`   Is Optimal = ${result.isOptimal}`);
        console.log(`   Status: ${result.success ? "✅ Healthy" : "⚠️  Warning"}`);

        return result.success;
    }

    async start() {
        if (this.isRunning) {
            console.log("⚠️  Monitor is already running");
            return;
        }

        this.isRunning = true;
        console.log("🤖 Starting Oracle Monitor");
        console.log(`   Interval: ${this.intervalMinutes} minutes`);
        console.log(`   Contract: ${process.env.ORACLE_ADDRESS || "0xDfb81fDfb8DeCDc7Fb6489d0022CD23697EEa3aE"}`);
        console.log("   Press Ctrl+C to stop\n");

        // Run immediately
        await this.runSingleTest();
        this.runCount++;

        // Then run on interval
        const intervalMs = this.intervalMinutes * 60 * 1000;
        this.intervalId = setInterval(async () => {
            this.runCount++;
            const success = await this.runSingleTest();
            
            if (!success) {
                console.log(`⚠️  Health check failed (run #${this.runCount})`);
            } else {
                console.log(`✅ Health check passed (run #${this.runCount})`);
            }

            // Print uptime stats
            const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
            console.log(`   Uptime: ${uptimeHours.toFixed(2)} hours | Total runs: ${this.runCount}\n`);
        }, intervalMs);
    }

    stop() {
        if (!this.isRunning) {
            console.log("⚠️  Monitor is not running");
            return;
        }

        clearInterval(this.intervalId);
        this.isRunning = false;
        
        const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
        console.log("\n🛑 Monitor stopped");
        console.log(`   Total runs: ${this.runCount}`);
        console.log(`   Uptime: ${uptimeHours.toFixed(2)} hours`);
    }
}

// Main execution
async function main() {
    const intervalMinutes = parseInt(process.env.MONITOR_INTERVAL_MINUTES || "5", 10);
    const monitor = new OracleMonitor(intervalMinutes);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
        console.log("\n\n🛑 Received SIGINT, shutting down gracefully...");
        monitor.stop();
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        console.log("\n\n🛑 Received SIGTERM, shutting down gracefully...");
        monitor.stop();
        process.exit(0);
    });

    await monitor.start();
}

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}

module.exports = { OracleMonitor };

