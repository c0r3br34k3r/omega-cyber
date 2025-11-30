const std = @import("std");

pub fn build(b: *std.Build) void {
    // Standard release options allow for compiling with 'zig build -Drelease-fast=true'
    // or 'zig build -Drelease-small=true'1
    const optimize = b.standardOptimizeOption(.{}).?.args[0];
    const target = b.standardTargetOption(.{}).?.args[0];

    const exe = b.addExecutable("sentinel-agents-zig", "src/main.zig");
    exe.setTarget(target);
    exe.setOptimize(optimize);
    exe.install();

    // No Zig tests for now, as testing frameworks would add complexity
    // const test_step = b.step("test", "Run Zig tests");
    // const unit_tests = b.addTest("sentinel-agents-unit-tests", "src/main.zig");
    // unit_tests.setTarget(target);
    // unit_tests.setOptimize(optimize);
    // test_step.dependOn(&unit_tests.run().step);

}
