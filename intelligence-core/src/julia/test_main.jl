# intelligence-core/src/julia/test_main.jl
using Test
using Sockets
using JSON
using Serialization
using Random
using LightGraphs
using JuMP # To access MOI.OPTIMAL for status checking

# Include the module for testing
include("main.jl")
using .IntelligenceCoreJulia # Access the module's contents

# --- Helper functions for TCP client interactions ---
function send_tcp_command(host::String, port::Int, command_dict::Dict)
    sock = connect(IPv4(host), port)
    
    request_json = JSON.json(command_dict)
    
    # Send length-prefixed message
    len_bytes = Serialization.serialize(IOBuffer(), length(request_json))
    write(sock, len_bytes)
    write(sock, request_json)

    # Read length-prefixed response
    response_len_bytes = read(sock, 4)
    response_len = Serialization.deserialize(IOBuffer(response_len_bytes))
    response_data = read(sock, response_len)
    
    close(sock)
    return JSON.parse(String(response_data))
end

# --- Test Suite ---
@testset "IntelligenceCoreJulia Tests" begin

    @testset "Data Structure Initialization" begin
        threat = IntelligenceCoreJulia.ThreatState("T1", 0.8, 0.9, ["nodeA"], "exploit")
        @test threat.id == "T1"
        @test threat.severity == 0.8
        @test threat.attack_vector == "exploit"

        resource = IntelligenceCoreJulia.DefenseResource("R1", "Sentinel", 100.0, Dict("exploit" => 0.5), 5, 10)
        @test resource.type == "Sentinel"
        @test resource.effectiveness["exploit"] == 0.5
    end

    @testset "optimize_defense_resources Function" begin
        threat = IntelligenceCoreJulia.ThreatState("T_DDoS", 0.9, 0.95, ["server1", "server2"], "DDoS")
        
        # Define resources
        res_sentinel = IntelligenceCoreJulia.DefenseResource("SentinelFirewall", "Sentinel", 500.0, Dict("DDoS" => 0.7, "Malware" => 0.1), 5, 10)
        res_deception = IntelligenceCoreJulia.DefenseResource("HoneypotNetwork", "Deception", 300.0, Dict("DDoS" => 0.3, "Recon" => 0.8), 3, 5)
        res_patching = IntelligenceCoreJulia.DefenseResource("PatchingTeam", "Human", 1000.0, Dict("Exploit" => 0.9), 1, 1)
        
        available_resources = [res_sentinel, res_deception, res_patching]
        objectives = Dict("impact_reduction" => 0.8, "cost_efficiency" => 0.2)

        @testset "Optimal Solution (enough budget)" begin
            budget = 5000.0 # Enough budget to deploy all sentinels and deceptions
            result = IntelligenceCoreJulia.optimize_defense_resources(threat, available_resources, budget, objectives)
            
            @test result.status == "OPTIMAL" || result.status == "HEURISTIC_FALLBACK" # Depending on Gurobi availability
            @test result.allocated_resources["SentinelFirewall"] <= res_sentinel.max_count
            @test result.allocated_resources["HoneypotNetwork"] <= res_deception.max_count
            @test result.total_cost <= budget
        end

        @testset "Budget Constrained Solution" begin
            budget = 1000.0 # Limited budget
            result = IntelligenceCoreJulia.optimize_defense_resources(threat, available_resources, budget, objectives)
            
            @test result.total_cost <= budget
            @test result.total_cost > 0.0 # Should deploy something
        end

        @testset "Unknown Attack Vector (effectiveness 0)" begin
            threat_unknown = IntelligenceCoreJulia.ThreatState("T_Phishing", 0.6, 0.7, ["user1"], "Phishing")
            # PatchingTeam is only effective against "Exploit"
            result = IntelligenceCoreJulia.optimize_defense_resources(threat_unknown, [res_patching], 1000.0, objectives)
            
            @test result.allocated_resources["PatchingTeam"] == 0 # Should not allocate if no effectiveness
            @test result.total_cost == 0.0
        end

        @testset "Empty Resources" begin
            result = IntelligenceCoreJulia.optimize_defense_resources(threat, [], 1000.0, objectives)
            @test result.status == "HEURISTIC_FALLBACK" # Heuristic will also handle this
            @test isempty(result.allocated_resources)
            @test result.total_cost == 0.0
        end
    end

    @testset "analyze_attack_path_impact Function" begin
        # Set random seed for reproducibility in tests
        Random.seed!(12345) 

        # Create a simple graph
        g = SimpleDiGraph(3)
        add_edge!(g, 1, 2)
        add_edge!(g, 2, 3)
        nodes = ["node1", "node2", "node3"]
        
        vulnerabilities = Dict("node1" => 0.1, "node2" => 0.8, "node3" => 0.9)
        defender_response_time = 5.0 # seconds

        @testset "Simple Attack Path" begin
            path = ["node1", "node2", "node3"]
            result = IntelligenceCoreJulia.analyze_attack_path_impact(path, g, vulnerabilities, defender_response_time)
            
            @test result["total_impact_score"] > 0.0
            @test result["time_to_compromise_seconds"] > 0.0
            @test result["compromised_nodes_count"] >= 1
            @test "node2" in result["compromised_nodes"] # Due to high vulnerability
        end

        @testset "Defender Responds Quickly" begin
            path = ["node1", "node2"]
            fast_defender_response_time = 0.1 # Very fast
            result = IntelligenceCoreJulia.analyze_attack_path_impact(path, g, vulnerabilities, fast_defender_response_time)
            
            # Impact might be lower due to faster response
            @test result["total_impact_score"] < 1.0 
        end
    end

    @testset "TCP Server Communication" begin
        server_host = "127.0.0.1"
        server_port = 50054 # Use a different port for testing

        # Start server in a separate task
        server_task = @async IntelligenceCoreJulia.start_tcp_server(server_host, server_port)
        
        # Give server a moment to start
        sleep(1)

        @testset "OPTIMIZE_RESOURCES Command" begin
            threat = IntelligenceCoreJulia.ThreatState("T_Test", 0.5, 0.5, ["test_node"], "TestAttack")
            res = IntelligenceCoreJulia.DefenseResource("TestRes", "Test", 10.0, Dict("TestAttack" => 0.8), 1, 1)
            budget = 100.0
            objectives = Dict("impact_reduction" => 1.0, "cost_efficiency" => 0.0)

            command = Dict(
                "command" => "OPTIMIZE_RESOURCES",
                "threat_state" => Dict(
                    "id" => threat.id, "severity" => threat.severity,
                    "impact_score" => threat.impact_score, "affected_nodes" => threat.affected_nodes,
                    "attack_vector" => threat.attack_vector
                ),
                "available_resources" => [Dict(
                    "id" => res.id, "type" => res.type, "cost" => res.cost,
                    "effectiveness" => res.effectiveness, "current_count" => res.current_count,
                    "max_count" => res.max_count
                )],
                "budget" => budget,
                "objectives" => objectives
            )
            
            response = send_tcp_command(server_host, server_port, command)
            @test response["result"]["status"] == "OPTIMAL" || response["result"]["status"] == "HEURISTIC_FALLBACK"
            @test response["result"]["allocated_resources"]["TestRes"] == 1
            @test response["result"]["total_cost"] == 10.0
        end

        @testset "ANALYZE_ATTACK_PATH Command" begin
            network_graph_data = Dict(
                "nodes" => ["A", "B"],
                "edges" => [Dict("src" => "A", "dst" => "B")]
            )
            command = Dict(
                "command" => "ANALYZE_ATTACK_PATH",
                "attack_path" => ["A", "B"],
                "network_graph" => network_graph_data,
                "vulnerabilities" => Dict("A" => 0.1, "B" => 0.9),
                "defender_response_time" => 1.0
            )
            response = send_tcp_command(server_host, server_port, command)
            @test response["result"]["total_impact_score"] > 0.0
            @test response["result"]["compromised_nodes_count"] >= 1
        end

        @testset "Unknown Command" begin
            command = Dict("command" => "UNKNOWN_COMMAND")
            response = send_tcp_command(server_host, server_port, command)
            @test response["error"] == "Unknown command: UNKNOWN_COMMAND"
            @test response["status"] == "ERROR"
        end

        # Ensure the server task can be cancelled/terminated (requires manual intervention or more sophisticated testing)
        # For a full test, one might send a shutdown command or kill the async task.
    end

    @testset "Command Line Argument Parsing" begin
        # Temporarily mock ARGS
        old_ARGS = ARGS
        empty!(ARGS)
        push!(ARGS, "--host", "127.0.0.2", "--port", "50055", "--config", "nonexistent_config.toml")
        
        # Mock start_tcp_server to verify arguments
        @test_logs (:info, r"Julia compute server starting on 127.0.0.2:50055") begin
            @eval begin
                function IntelligenceCoreJulia.start_tcp_server(host::String, port::Int)
                    @info "Julia compute server starting on $(host):$(port)" # This is the log we capture
                    throw(InterruptException()) # Exit the server after logging
                end
            end
            @test_throws InterruptException IntelligenceCoreJulia.julia_main()
        end
        
        empty!(ARGS)
        append!(ARGS, old_ARGS) # Restore ARGS
    end

end # @testset "IntelligenceCoreJulia Tests"