// Copyright 2025 c0r3br34k3r
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config_test

import (
	"os"
	"testing"

	"github.com/omega-cyber/mesh-network/internal/config"
	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
)

func TestLoad(t *testing.T) {
	// Clean up any previous viper state
	viper.Reset()

	t.Run("defaults are loaded correctly", func(t *testing.T) {
		cfg := config.Load()
		assert.NotNil(t, cfg)
		assert.Equal(t, config.DefaultNodeID, cfg.Node.ID)
		assert.Equal(t, config.DefaultGRPCPort, cfg.Node.GRPCPort)
		assert.Equal(t, config.DefaultP2PPort, cfg.Node.P2PPort)
		assert.Empty(t, cfg.Node.JoinAddresses)
		assert.Equal(t, "localhost:50050", cfg.TrustFabric.GRPCAddress)
	})

	t.Run("environment variables override defaults", func(t *testing.T) {
		os.Setenv("OMEGA_NODE_ID", "test-node-123")
		os.Setenv("OMEGA_NODE_GRPC_PORT", "6000")
		os.Setenv("OMEGA_TRUSTFABRIC_GRPCADDRESS", "tf.example.com:50050")
		defer os.Unsetenv("OMEGA_NODE_ID")
		defer os.Unsetenv("OMEGA_NODE_GRPC_PORT")
		defer os.Unsetenv("OMEGA_TRUSTFABRIC_GRPCADDRESS")
		viper.Reset() // Reset viper before loading again

		cfg := config.Load()
		assert.NotNil(t, cfg)
		assert.Equal(t, "test-node-123", cfg.Node.ID)
		assert.Equal(t, 6000, cfg.Node.GRPCPort)
		assert.Equal(t, config.DefaultP2PPort, cfg.Node.P2PPort) // Default not overridden
		assert.Equal(t, "tf.example.com:50050", cfg.TrustFabric.GRPCAddress)
	})

	t.Run("config file values override defaults and env", func(t *testing.T) {
		// Create a temporary config file
		tempConfigFile := "test_config.yaml"
		content := `
node:
  id: "file-node-456"
  grpc_port: 7000
  p2p_port: 8000
  join_addresses:
    - "/ip4/127.0.0.1/tcp/4001/p2p/QmTestPeer1"
trust_fabric:
  grpc_address: "tf.file.com:50050"
`
		err := os.WriteFile(tempConfigFile, []byte(content), 0644)
		assert.NoError(t, err)
		defer os.Remove(tempConfigFile)

		// Set viper to look for our temporary file
		viper.Reset()
		viper.SetConfigName("test_config")
		viper.SetConfigType("yaml")
		viper.AddConfigPath(".")

		// Set environment variable, which should be overridden by file
		os.Setenv("OMEGA_NODE_ID", "env-node-override")
		defer os.Unsetenv("OMEGA_NODE_ID")

		cfg := config.Load()
		assert.NotNil(t, cfg)
		assert.Equal(t, "file-node-456", cfg.Node.ID) // File overrides env
		assert.Equal(t, 7000, cfg.Node.GRPCPort)
		assert.Equal(t, 8000, cfg.Node.P2PPort)
		assert.Contains(t, cfg.Node.JoinAddresses, "/ip4/127.0.0.1/tcp/4001/p2p/QmTestPeer1")
		assert.Equal(t, "tf.file.com:50050", cfg.TrustFabric.GRPCAddress)
	})
}
