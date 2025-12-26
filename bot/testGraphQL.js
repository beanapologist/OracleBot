// Quick test of Polymarket GraphQL subgraph
const ORDERBOOK_SUBGRAPH = "https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/prod/gn";

async function testGraphQL() {
    console.log("Testing Polymarket GraphQL Subgraph...\n");

    // Test 1: Introspect schema
    const introspectionQuery = `
        query IntrospectSchema {
            __schema {
                queryType {
                    fields {
                        name
                        type {
                            name
                        }
                    }
                }
            }
        }
    `;

    // Test 2: Try different field names
    const queries = [
        { name: "orderbooks", query: `{ orderbooks(first: 5) { id } }` },
        { name: "positions", query: `{ positions(first: 5) { id } }` },
        { name: "markets", query: `{ markets(first: 5) { id } }` },
        { name: "tokens", query: `{ tokens(first: 5) { id } }` },
    ];

    // Try introspection first
    try {
        console.log("Introspecting schema...");
        const response = await fetch(ORDERBOOK_SUBGRAPH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: introspectionQuery })
        });

        const data = await response.json();
        if (data.data?.__schema) {
            console.log("Available query fields:");
            data.data.__schema.queryType.fields.forEach(f => {
                console.log(`   - ${f.name}: ${f.type.name || 'Complex'}`);
            });
        } else {
            console.log("Introspection response:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("❌ Introspection error:", error.message);
    }

    // Introspect Orderbook type
    const orderbookTypeQuery = `
        query IntrospectOrderbook {
            __type(name: "Orderbook") {
                fields {
                    name
                    type {
                        name
                        kind
                    }
                }
            }
        }
    `;

    // Query orderbooks with just id first
    const simpleQuery = `
        query GetOrderbooks {
            orderbooks(first: 3) {
                id
            }
        }
    `;

    // First, introspect Orderbook type
    try {
        console.log("\nIntrospecting Orderbook type...");
        const response = await fetch(ORDERBOOK_SUBGRAPH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: orderbookTypeQuery })
        });

        const typeData = await response.json();
        if (typeData.data?.__type) {
            console.log("Orderbook fields:");
            typeData.data.__type.fields.forEach(f => {
                console.log(`   - ${f.name}: ${f.type.name || f.type.kind}`);
            });
        }
    } catch (error) {
        console.error("❌ Introspection error:", error.message);
    }

    // Introspect MarketData type
    const marketDataTypeQuery = `
        query IntrospectMarketData {
            __type(name: "MarketData") {
                fields {
                    name
                    type {
                        name
                        kind
                    }
                }
            }
        }
    `;

    // Query marketDatas
    const marketDataQuery = `
        query GetMarketData {
            marketDatas(first: 3) {
                id
            }
        }
    `;

    // Introspect OrderFilledEvent
    const orderEventTypeQuery = `
        query IntrospectOrderFilledEvent {
            __type(name: "OrderFilledEvent") {
                fields {
                    name
                    type {
                        name
                        kind
                    }
                }
            }
        }
    `;

    // Query orderFilledEvents (simple)
    const orderEventsQuery = `
        query GetOrderEvents {
            orderFilledEvents(first: 5) {
                id
            }
        }
    `;

    try {
        console.log("\nIntrospecting MarketData type...");
        const response = await fetch(ORDERBOOK_SUBGRAPH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: marketDataTypeQuery })
        });

        const typeData = await response.json();
        if (typeData.data?.__type) {
            console.log("MarketData fields:");
            typeData.data.__type.fields.forEach(f => {
                console.log(`   - ${f.name}: ${f.type.name || f.type.kind}`);
            });
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }

    try {
        console.log("\nIntrospecting OrderFilledEvent type...");
        const response = await fetch(ORDERBOOK_SUBGRAPH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: orderEventTypeQuery })
        });

        const typeData = await response.json();
        if (typeData.data?.__type) {
            console.log("OrderFilledEvent fields:");
            typeData.data.__type.fields.forEach(f => {
                console.log(`   - ${f.name}: ${f.type.name || f.type.kind}`);
            });
        }

        console.log("\nQuerying orderFilledEvents...");
        const response2 = await fetch(ORDERBOOK_SUBGRAPH, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: orderEventsQuery })
        });

        const data = await response2.json();
        console.log("Order Events Response:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testGraphQL().catch(console.error);

