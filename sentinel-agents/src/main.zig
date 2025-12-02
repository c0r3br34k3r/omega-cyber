// src/main.zig
// ==============================================================================
// OMEGA PLATFORM - SENTINEL AGENT (ZIG COMPONENT)
// ==============================================================================
//
// This file contains the Zig implementation for the Sentinel Agent. It is
// compiled as a static library and exposes a C-compatible FFI for use by the
// C orchestrator (`main.c`).
//
// Responsibilities:
// - Performing extremely low-level system checks, such as direct memory scanning.
// - Interacting with kernel data structures or other sensitive system areas.
// - Providing safe, high-performance alternatives to complex C code.
//

const std = @import("std");
const c = @cImport({
    @cInclude("stdio.h");
});

// --- Build Information ---
// This struct will be populated by the `build.zig` script with build-time info.
const BuildInfo = struct {
    git_commit_hash: []const u8,
    build_timestamp: []const u8,
    build_mode: std.builtin.OptimizeMode,
};
const build_info = @import("build_info");

// --- Global State & Allocator ---
// Zig encourages explicit memory management. We'll use a general-purpose allocator
// for any dynamic memory needs within this component.
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const allocator = gpa.allocator();

// ==============================================================================
// FFI - EXPORTED FUNCTIONS
// ==============================================================================

// --- Component Lifecycle ---

/// Initializes the Zig component.
/// This function should be called once when the agent starts.
export fn zig_component_init() void {
    _ = gpa.init(std.heap.page_allocator);
    c.printf("[Zig] Component initialized. Build: %s, Time: %s, Mode: %s\n", .{
        build_info.git_commit_hash,
        build_info.build_timestamp,
        @tagName(build_info.build_mode),
    });
}

/// Shuts down the Zig component and deinitializes its resources.
export fn zig_component_shutdown() void {
    // Check for memory leaks if in debug mode.
    const deinit_status = gpa.deinit();
    if (deinit_status == .leak) {
        c.printf("[Zig] WARNING: Memory leak detected during shutdown.\n");
    }
    c.printf("[Zig] Component shut down.\n");
}


// --- Core Logic ---

/// Performs a low-level system scan.
/// For this example, it simulates scanning a memory region for a mock malware signature.
///
/// @param target: A C string indicating the scan target (e.g., "/proc/mem").
/// @return The number of anomalies found.
export fn zig_perform_low_level_scan(target: [*c]const u8) c_int {
    const target_slice = std.mem.span(target);
    c.printf("[Zig] Performing low-level scan on target: %s\n", target);

    // Simulate scanning a memory region. In a real agent, this would involve
    // opening /proc/kmem, a memory-mapped file, or using OS-specific APIs.
    // Here, we create a mock memory buffer to scan.
    var mock_memory_buffer: [1024]u8 = undefined;
    
    // Fill the buffer with some random data
    var prng = std.rand.DefaultPrng.init(0);
    prng.fill(mock_memory_buffer[0..]);

    // Embed a mock malware signature a few times
    const malware_signature = "OMEGA_MALWARE_SIG";
    @memcpy(mock_memory_buffer[100..][0..malware_signature.len], malware_signature);
    @memcpy(mock_memory_buffer[500..][0..malware_signature.len], malware_signature);
    @memcpy(mock_memory_buffer[900..][0..malware_signature.len], malware_signature);

    var anomalies_found: c_int = 0;
    var i: usize = 0;

    // Use a safe loop to scan the memory buffer for the signature.
    while (i < mock_memory_buffer.len - malware_signature.len) {
        const window = mock_memory_buffer[i .. i + malware_signature.len];
        if (std.mem.eql(u8, window, malware_signature)) {
            c.printf("[Zig] Found malware signature at memory offset %d\n", i);
            anomalies_found += 1;
            i += malware_signature.len; // Skip past the found signature
        } else {
            i += 1;
        }
    }

    return anomalies_found;
}

// --- Main Function (for library builds) ---
// This is not strictly necessary for a static library but is good practice.
pub fn main() !void {
    // This library is not intended to be run as a standalone executable.
    // The main entry point for testing is `zig build test`.
    const stderr = std.io.getStdErr().writer();
    try stderr.print("This is a static library for the Omega Sentinel Agent. It is not runnable.\n", .{});
}
