# CMakeLists.txt for Omega Sentinel Agent (Polyglot C++/Rust/Zig)
# ==============================================================================
#
# This file orchestrates the build process for the Sentinel Agent, which is
# composed of C++, Rust, and Zig components. It demonstrates a sophisticated
# polyglot build system where CMake is the top-level build orchestrator.
#
# ==============================================================================

# --- 1. Project Definition & Configuration ---
cmake_minimum_required(VERSION 3.15)

project(
    sentinel-agent-polyglot
    VERSION 0.2.0
    DESCRIPTION "Omega Sentinel Agent - Polyglot C++/Rust/Zig Implementation"
    LANGUAGES CXX C
)

# Set modern C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# --- 2. Build Options ---
option(BUILD_SHARED_LIBS "Build shared libraries" ON)
option(SENTINEL_ENABLE_TESTING "Enable building of tests" ON)
option(SENTINEL_ENABLE_RUST_COMPONENT "Enable Rust component integration" ON)
option(SENTINEL_ENABLE_ZIG_COMPONENT "Enable Zig component integration" ON)

# --- 3. Source Files & Targets (C++ Component) ---
# Define the C++ part of the agent, which acts as the main orchestrator
add_library(sentinel_cxx_lib
    src/main.c
    # Add other C++ source files here, e.g., src/telemetry_processor.cpp
)

target_include_directories(sentinel_cxx_lib PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

# Main executable for the C++-driven agent
add_executable(sentinel-agent-cxx src/main.c)

# --- 4. Rust Component Integration (via ExternalProject) ---
if(SENTINEL_ENABLE_RUST_COMPONENT)
    include(ExternalProject)

    # Define the build type for the Rust project based on the CMake build type
    if(CMAKE_BUILD_TYPE MATCHES "Release")
        set(RUST_BUILD_TYPE "--release")
    else()
        set(RUST_BUILD_TYPE "")
    endif()

    ExternalProject_Add(sentinel_rust_component
        SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}
        # The Rust build does not need a configure step
        CONFIGURE_COMMAND ""
        # Build command using cargo
        BUILD_COMMAND cargo build --manifest-path ${CMAKE_CURRENT_SOURCE_DIR}/Cargo.toml ${RUST_BUILD_TYPE}
        # The install step is not needed as we will link against the build artifacts directly
        INSTALL_COMMAND ""
        # Ensure Rust build artifacts are cleaned when `make clean` is called
        BUILD_BYPRODUCTS <BINARY_DIR>/rust_build/target/${CMAKE_BUILD_TYPE}/libsentinel_agent_rust.a
    )

    # Create an imported library target for the Rust static library
    add_library(sentinel_rust_lib STATIC IMPORTED)
    set_property(TARGET sentinel_rust_lib PROPERTY
        IMPORTED_LOCATION <BINARY_DIR>/rust_build/target/${CMAKE_BUILD_TYPE}/libsentinel_agent_rust.a
    )
    add_dependencies(sentinel_rust_lib sentinel_rust_component)

    # Link the C++ executable against the Rust library
    target_link_libraries(sentinel-agent-cxx PRIVATE sentinel_rust_lib)
    message(STATUS "Rust component integration enabled.")
endif()

# --- 5. Zig Component Integration (via execute_process) ---
if(SENTINEL_ENABLE_ZIG_COMPONENT)
    # Define Zig build command
    set(ZIG_BUILD_CMD zig build -Doptimize=${CMAKE_BUILD_TYPE})
    
    # Execute the Zig build process
    execute_process(
        COMMAND ${ZIG_BUILD_CMD}
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        RESULT_VARIABLE ZIG_BUILD_RESULT
    )
    if(NOT ZIG_BUILD_RESULT EQUAL 0)
        message(FATAL_ERROR "Zig build failed with exit code ${ZIG_BUILD_RESULT}")
    endif()

    # Create an imported library target for the Zig static library
    add_library(sentinel_zig_lib STATIC IMPORTED)
    set_property(TARGET sentinel_zig_lib PROPERTY
        IMPORTED_LOCATION ${CMAKE_CURRENT_SOURCE_DIR}/zig-out/lib/sentinel-agent-zig.a
    )

    # Link the C++ executable against the Zig library
    target_link_libraries(sentinel-agent-cxx PRIVATE sentinel_zig_lib)
    message(STATUS "Zig component integration enabled.")
endif()

# --- 6. External Dependencies (e.g., OpenSSL) ---
find_package(OpenSSL REQUIRED)
target_link_libraries(sentinel-agent-cxx PRIVATE OpenSSL::SSL OpenSSL::Crypto)

# --- 7. Testing (CTest) ---
if(SENTINEL_ENABLE_TESTING)
    enable_testing()
    
    # Add a C++ test executable
    add_executable(sentinel_cxx_tests src/tests/main_test.cpp)
    target_link_libraries(sentinel_cxx_tests PRIVATE sentinel_cxx_lib)
    
    # Example for adding a simple test
    add_test(NAME CxxComponentTest COMMAND sentinel_cxx_tests)
    
    # Add a test that runs the Rust tests via cargo
    if(SENTINEL_ENABLE_RUST_COMPONENT)
        add_test(
            NAME RustComponentTests
            COMMAND cargo test --manifest-path ${CMAKE_CURRENT_SOURCE_DIR}/Cargo.toml
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        )
    endif()
    
    # Add a test that runs the Zig tests
    if(SENTINEL_ENABLE_ZIG_COMPONENT)
        add_test(
            NAME ZigComponentTests
            COMMAND zig build test
            WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
        )
    endif()
endif()

# --- 8. Installation ---
install(
    TARGETS sentinel-agent-cxx
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib/static
)

install(
    DIRECTORY include/
    DESTINATION include
)

# --- Final Message ---
message(STATUS "CMake configuration for Sentinel Agent complete.")