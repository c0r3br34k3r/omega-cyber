# test_main.jl for intelligence-core

include("main.jl") # Include the main logic to be tested
using Test

@testset "Intelligence Core Julia Tests" begin
    @testset "process_telemetry_data" begin
        # Test case 1: Data with events
        telemetry_with_events = Dict(
            "source" => "endpointA",
            "events" => [
                Dict("id" => 1, "severity" => 3, "type" => "info"),
                Dict("id" => 2, "severity" => 8, "type" => "alert"),
                Dict("id" => 3, "severity" => 6, "type" => "warning")
            ]
        )
        result1 = process_telemetry_data(telemetry_with_events)
        @test result1["processed_events"] == 2
        @test result1["original_count"] == 3

        # Test case 2: Data without events
        telemetry_no_events = Dict(
            "source" => "endpointB"
        )
        result2 = process_telemetry_data(telemetry_no_events)
        @test result2["status"] == "no_events_to_process"

        # Test case 3: Data with no high-severity events
        telemetry_low_severity = Dict(
            "source" => "endpointC",
            "events" => [
                Dict("id" => 4, "severity" => 1, "type" => "debug"),
                Dict("id" => 5, "severity" => 2, "type" => "info")
            ]
        )
        result3 = process_telemetry_data(telemetry_low_severity)
        @test result3["processed_events"] == 0
        @test result3["original_count"] == 2
    end
end
