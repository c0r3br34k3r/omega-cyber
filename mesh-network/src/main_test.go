package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
)

func TestSendMessage(t *testing.T) {
	// Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	sendMessage("PeerX", "Test Message")

	w.Close()
	os.Stdout = oldStdout
	out, _ := io.ReadAll(r)
	output := string(out)

	if !strings.Contains(output, "Sending message 'Test Message' to peer PeerX") {
		t.Errorf("TestSendMessage failed: expected output not found. Got: %s", output)
	}
}

func TestReceiveMessage(t *testing.T) {
	// Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	receiveMessage("PeerY", "Received Ack")

	w.Close()
	os.Stdout = oldStdout
	out, _ := io.ReadAll(r)
	output := string(out)

	if !strings.Contains(output, "Receiving message 'Received Ack' from peer PeerY") {
		t.Errorf("TestReceiveMessage failed: expected output not found. Got: %s", output)
	}
}

// Helper to copy an agent state table
func copyTable(t map[string]interface{}) map[string]interface{} {
    t2 := make(map[string]interface{})
    for k, v := range t {
        t2[k] = v
    }
    return t2
}
