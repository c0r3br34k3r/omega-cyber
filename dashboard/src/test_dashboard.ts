// dashboard/src/test_dashboard.ts
// Simple self-contained tests for dashboard logic (mocked)

import { generateRandomMetric, renderMetric } from './dashboard'; // Assuming these are exported

let consoleErrorMessages: string[] = [];
const originalConsoleError = console.error;

// Mock console.error to capture messages
console.error = (...args: any[]) => {
    consoleErrorMessages.push(args.join(' '));
    // originalConsoleError.apply(console, args); // Optionally still log to console
};

function runTest(name: string, testFunction: () => void) {
    console.log(`--- Running Test: ${name} ---`);
    consoleErrorMessages = []; // Clear messages for each test
    try {
        testFunction();
        console.log(`PASS: ${name}`);
    } catch (e: any) {
        console.log(`FAIL: ${name} - ${e.message}`);
    }
    console.log("------------------------\n");
}

runTest('generateRandomMetric should return valid metric data', () => {
    const metric = generateRandomMetric("Test Metric", 0, 100, "units");
    if (!metric || typeof metric.name !== 'string' || typeof metric.value !== 'number' || typeof metric.unit !== 'string' || typeof metric.timestamp !== 'number') {
        throw new Error('Invalid metric data structure.');
    }
    if (metric.value < 0 || metric.value > 100) {
        throw new Error('Metric value out of range.');
    }
});

runTest('renderMetric should produce correct HTML structure', () => {
    const metric = { name: "CPU Test", value: 50.5, unit: "%", timestamp: 1678886400000 };
    const html = renderMetric(metric);
    if (!html.includes('<h3>CPU Test</h3>') || !html.includes('<p>50.5 %</p>')) {
        throw new Error('Rendered HTML does not match expected structure.');
    }
});


// Restore original console.error after all tests
console.error = originalConsoleError;

console.log("All TypeScript (dashboard) tests completed.");
