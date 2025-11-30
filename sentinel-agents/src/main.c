#include <stdio.h>
#include <stdbool.h>
#include <unistd.h> // For sleep
#include <time.h>   // For random seed

// Simulate a kernel hook for file access monitoring
bool simulate_file_access_monitor(const char* filename, int pid) {
    printf("[C Agent] Monitoring file access for \'%s\' by process %d\n", filename, pid);
    usleep(50000); // Simulate some work (50ms)
    // In a real scenario, this would interface with OS kernel APIs (e.g., inotify, kprobes)
    if (pid % 3 == 0) { // Simulate suspicious activity for certain PIDs
        printf("[C Agent] Alert: Suspicious access to \'%s\' by process %d.\n", filename, pid);
        return false;
    } else {
        printf("[C Agent] File access to \'%s\' by process %d looks normal.\n", filename, pid);
        return true;
    }
}

// Simulate a memory-safe buffer operation
void process_buffer_safely(unsigned char* buffer, size_t size) {
    printf("[C Agent] Processing %zu bytes of buffer safely.\n", size);
    for (size_t i = 0; i < size; ++i) {
        buffer[i] = buffer[i] + 1; // Simple transformation
    }
    usleep(20000); // Simulate some work (20ms)
    printf("[C Agent] Buffer processed.\n");
}

int main() {
    printf("Hello from C sentinel agent!\n");

    // Seed random for more varied simulation
    srand(time(NULL));

    // Simulate file access monitoring
    simulate_file_access_monitor("/etc/passwd", 123);
    simulate_file_access_monitor("/var/log/syslog", 456);
    simulate_file_access_monitor("/tmp/malicious.sh", 789); // Suspicious PID

    // Simulate memory-safe buffer operation
    unsigned char data[] = {0x11, 0x22, 0x33, 0x44};
    size_t data_size = sizeof(data) / sizeof(data[0]);
    printf("[C Agent] Original C data: 0x%02x 0x%02x 0x%02x 0x%02x\n", data[0], data[1], data[2], data[3]);
    process_buffer_safely(data, data_size);
    printf("[C Agent] Processed C data: 0x%02x 0x%02x 0x%02x 0x%02x\n", data[0], data[1], data[2], data[3]);

    return 0;
}