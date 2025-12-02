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

package config

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

// Global Constants for configuration defaults
const (
	DefaultGRPCPort = 50051
	DefaultP2PPort  = 7946
	DefaultNodeID   = "mesh-node-01"
)

// NodeConfig holds the configuration specific to this mesh node.
type NodeConfig struct {
	ID            string
	GRPCPort      int
	P2PPort       int
	JoinAddresses []string
}

// TrustFabricConfig holds the configuration for connecting to the Trust Fabric service.
type TrustFabricConfig struct {
	GRPCAddress string
}

// Config is the top-level configuration structure for the application.
type Config struct {
	Node        NodeConfig
	TrustFabric TrustFabricConfig
}

// Load loads configuration from environment variables and a config file.
func Load() *Config {
	viper.AutomaticEnv()
	viper.SetEnvPrefix("OMEGA") // e.g., OMEGA_NODE_ID, OMEGA_TRUSTFABRIC_GRPCADDRESS

	// Set defaults
	viper.SetDefault("node.id", DefaultNodeID)
	viper.SetDefault("node.grpc_port", DefaultGRPCPort)
	viper.SetDefault("node.p2p_port", DefaultP2PPort)
	viper.SetDefault("node.join_addresses", []string{})
	viper.SetDefault("trust_fabric.grpc_address", "localhost:50050")

	// Try to read config file if it exists (e.g., config.yaml)
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("/etc/omega/")
	viper.AddConfigPath("$HOME/.omega")
	viper.AddConfigPath(".")
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			logrus.WithError(err).Warn("Failed to read config file")
		}
	}

	cfg := &Config{}
	if err := viper.Unmarshal(cfg); err != nil {
		logrus.WithError(err).Fatal("Failed to unmarshal config")
	}

	return cfg
}
