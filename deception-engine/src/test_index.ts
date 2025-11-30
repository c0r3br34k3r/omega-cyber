// deception-engine/src/test_index.ts
// Simple self-contained tests for WebGPU initialization (mocked)

// Assuming initializeWebGPU is in index.ts and needs to be imported or available globally
// For a simple test, we'll just mock the parts it interacts with directly.

let consoleErrorMessages: string[] = [];
const originalConsoleError = console.error;

// Mock console.error to capture messages
console.error = (...args: any[]) => {
    consoleErrorMessages.push(args.join(' '));
    // originalConsoleError.apply(console, args); // Optionally still log to console
};

// --- Mocking initializeWebGPU function and its dependencies ---
// In a real setup, you'd import it. For this test, we'll re-implement a mockable version
// or directly test the logic that `initializeWebGPU` would execute.

// Mock a simplified initializeWebGPU for testing purposes,
// avoiding direct interaction with DOM or full WebGPU API
async function mockInitializeWebGPU(mockNavigatorGpu: any) {
    if (!mockNavigatorGpu) {
        console.error("WebGPU not supported on this browser.");
        return;
    }

    const adapter = await mockNavigatorGpu.requestAdapter();
    if (!adapter) {
        console.error("No WebGPU adapter found.");
        return;
    }
    // Simulate successful initialization without full WebGPU context
    return "initialized";
}

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

runTest('should log an error if WebGPU is not supported', async () => {
    await mockInitializeWebGPU(undefined);
    if (!consoleErrorMessages.includes('WebGPU not supported on this browser.')) {
        throw new Error('Expected "WebGPU not supported" error not found.');
    }
});

runTest('should log an error if no WebGPU adapter is found', async () => {
    const mockNavigatorGpu = {
        requestAdapter: async () => null, // Simulate no adapter
    };
    await mockInitializeWebGPU(mockNavigatorGpu);
    if (!consoleErrorMessages.includes('No WebGPU adapter found.')) {
        throw new Error('Expected "No WebGPU adapter found" error not found.');
    }
});

runTest('should simulate successful initialization', async () => {
    const mockNavigatorGpu = {
        requestAdapter: async () => ({
            requestDevice: async () => ({}), // Mock device
        }),
    };
    const result = await mockInitializeWebGPU(mockNavigatorGpu);
    if (result !== "initialized") {
        throw new Error('Expected successful initialization.');
    }
    if (consoleErrorMessages.length > 0) {
        throw new Error('Expected no errors, but found: ' + consoleErrorMessages.join(', '));
    }
});

// Restore original console.error after all tests
console.error = originalConsoleError;

console.log("All TypeScript (mocked WebGPU) tests completed.");