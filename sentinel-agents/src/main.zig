const std = @import("std");
const time = std.time;
const rand = std.rand;

// Simulate an agent runtime task processing
pub fn process_agent_task(task_id: u32, data: []const u8) !void {
    const stdout = std.io.getStdout().writer();
    try stdout.print("[Zig Agent] Processing task {d} with {d} bytes of data.\n", .{task_id, data.len});
    time.sleep(time.ns_per_ms * 30); // Simulate some work (30ms)

    // Simulate task outcome
    var rng = rand.DefaultPrng.init(time.nanoTimestamp());
    if (rng.random().int(u8) % 2 == 0) {
        try stdout.print("[Zig Agent] Task {d} completed successfully.\n", .{task_id});
    } else {
        try stdout.print("[Zig Agent] Task {d} encountered a minor issue.\n", .{task_id});
    }
}

pub fn main() !void {
    const stdout = std.io.getStdout().writer();
    try stdout.print("Hello from Zig sentinel agent!\n", .{});

    // Simulate some agent tasks
    try process_agent_task(101, "payload_a".ptr[0..9]);
    try process_agent_task(102, "payload_b_long_data".ptr[0..19]);
    try process_agent_task(103, "".ptr[0..0]);
}