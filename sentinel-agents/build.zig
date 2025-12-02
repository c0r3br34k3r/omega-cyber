// build.zig
// ==============================================================================
// OMEGA PLATFORM - SENTINEL AGENT (ZIG) BUILD SCRIPT
// ==============================================================================
//
// This file defines the build process for the Zig-based Sentinel Agent. It is
// designed to be highly configurable, supporting cross-compilation, different
// optimization levels, and advanced features like Link-Time Optimization (LTO).
//

const std = @import("std");

pub fn build(b: *std.Build) void {
    // --- 1. Target and Optimization Options ---
    // Standard target options allow for easy cross-compilation.
    // e.g., `zig build -Dtarget=aarch64-linux-gnu`
    const target = b.standardTargetOptions(.{});

    // Standard optimization options.
    // e.g., `zig build -Doptimize=ReleaseSmall`
    const optimize = b.standardOptimizeOption(.{});

    // --- 2. Custom Build Options ---
    const enable_lto = b.option(bool, "enable_lto", "Enable Link-Time Optimization (LTO) for a smaller, faster binary.");
    const is_static = b.option(bool, "static", "Build a statically linked executable.");

    // --- 3. Executable Definition ---
    const exe = b.addExecutable(.{
        .name = "sentinel-agent-zig",
        .root_source_file = .{ .path = "src/main.zig" },
        .target = target,
        .optimize = optimize,
    });

    // --- 4. C Interoperability ---
    // Link against libc for standard system functions.
    exe.linkSystemLibrary("c");
    // If there were C source files to compile and link:
    // exe.addCSourceFile("src/some_c_code.c", &[_][]const u8{"-std=c11"});

    // --- 5. Link-Time Optimization (LTO) ---
    // LTO can produce smaller and faster binaries, ideal for release builds.
    if (enable_lto) {
        exe.lto = .full;
    }

    // --- 6. Static Linking ---
    // For creating self-contained binaries with no external dependencies.
    if (is_static) {
        exe.linkage = .static;
    }

    // --- 7. Embedding Build Information ---
    // Embed build information (like Git commit hash) into the binary.
    const git_commit_hash = b.exec(&[_][]const u8{"git", "rev-parse", "--short", "HEAD"});
    exe.addOptions("build_info", .{
        .git_commit_hash = git_commit_hash,
        .build_timestamp = @intToStr(std.time.timestamp()),
        .build_mode = @tagName(optimize),
    });
    
    b.installArtifact(exe);

    // --- 8. Build Runner ---
    // This allows `zig build run` to execute the compiled binary.
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);

    // --- 9. Unit Tests ---
    // `zig build test` will compile and run the tests.
    const unit_tests = b.addTest(.{
        .root_source_file = .{ .path = "src/main.zig" },
        .target = target,
        .optimize = optimize,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}