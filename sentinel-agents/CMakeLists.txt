cmake_minimum_required(VERSION 3.10)
project(sentinel-agents C CXX)

add_executable(sentinel-agents-c src/main.c)
# No C/C++ tests for now, as testing frameworks would add complexity
# add_test(NAME C_Agent_Test COMMAND sentinel-agents-c)
