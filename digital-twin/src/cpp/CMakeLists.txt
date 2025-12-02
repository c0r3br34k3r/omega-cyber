# digital-twin/src/cpp/CMakeLists.txt
# ==============================================================================
# OMEGA PLATFORM - DIGITAL TWIN C++ SIMULATION ENGINE (AquaWarSDK)
# ==============================================================================
#
# This file defines the build process for the C++ based AquaWarSDK, a high-
# performance simulation engine for testing defensive strategies in a game-like
# environment.
#
# ==============================================================================

cmake_minimum_required(VERSION 3.16)

project(
    AquaWarSDK
    VERSION 1.0.0
    DESCRIPTION "A high-performance C++ simulation engine for the Omega Digital Twin."
    LANGUAGES CXX
)

# --- 1. Project Configuration ---
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Add include directory for public headers
include_directories(include)

# --- 2. Build Options ---
option(AQUAWAR_BUILD_SHARED "Build AquaWarSDK as a shared library" ON)
option(AQUAWAR_BUILD_EXAMPLES "Build example usage executable" ON)
option(AQUAWAR_ENABLE_TESTING "Enable building of tests" ON)

# --- 3. Dependencies ---
# Find nlohmann::json for JSON processing. Assumes it's installed system-wide
# or can be found via find_package. A fallback would be to use add_subdirectory.
find_package(nlohmann_json 3.2.0 REQUIRED)

# --- 4. Library Target Definition ---
# Define the source files for the SDK library
set(SDK_SOURCES
    src/AquaWarSDK.cpp
    src/Game.cpp
    # Add other source files here
)

if(AQUAWAR_BUILD_SHARED)
    add_library(aquawar_sdk SHARED ${SDK_SOURCES})
    set_target_properties(aquawar_sdk PROPERTIES
        PUBLIC_HEADER "include/AquaWarSDK.h;include/Game.h"
    )
else()
    add_library(aquawar_sdk STATIC ${SDK_SOURCES})
endif()

# Link dependencies to the SDK library
target_link_libraries(aquawar_sdk PUBLIC nlohmann_json::nlohmann_json)

# --- 5. Example Executable ---
if(AQUAWAR_BUILD_EXAMPLES)
    add_executable(aquawar_example src/main.cpp)
    target_link_libraries(aquawar_example PRIVATE aquawar_sdk)
endif()

# --- 6. Testing (CTest) ---
if(AQUAWAR_ENABLE_TESTING)
    enable_testing()
    
    # Add a test executable
    add_executable(sdk_tests
        tests/Game_test.cpp
        tests/AquaWarSDK_test.cpp
    )
    
    # Find GTest (or another testing framework)
    find_package(GTest REQUIRED)
    target_link_libraries(sdk_tests PRIVATE aquawar_sdk GTest::GTest GTest::Main)
    
    include(GoogleTest)
    gtest_discover_tests(sdk_tests)
endif()

# --- 7. Installation ---
# Defines rules for `make install`
install(
    TARGETS aquawar_sdk
    EXPORT AquaWarSDKTargets
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib/static
    PUBLIC_HEADER DESTINATION include
)

install(
    DIRECTORY include/
    DESTINATION include
)

install(
    EXPORT AquaWarSDKTargets
    FILE AquaWarSDKTargets.cmake
    NAMESPACE AquaWar::
    DESTINATION lib/cmake/AquaWarSDK
)

# --- Final Message ---
message(STATUS "AquaWarSDK configuration complete. Build type: ${CMAKE_BUILD_TYPE}")
