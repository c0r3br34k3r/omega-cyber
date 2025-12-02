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

package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/omega-cyber/mesh-network/internal/config"
	"github.com/omega-cyber/mesh-network/internal/grpc"
	"github.com/omega-cyber/mesh-network/internal/p2p"
	"github.com/sirupsen/logrus"
)

func main() {
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
		DisableColors: false,
	})
	logrus.SetLevel(logrus.InfoLevel)

	cfg := config.Load()
	logrus.Infof("Starting Mesh Node %s with gRPC Port %d, P2P Port %d", cfg.Node.ID, cfg.Node.GRPCPort, cfg.Node.P2PPort)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Trust Fabric Client (placeholder)
	// tfClient, err := grpc.NewTrustFabricClient(cfg.TrustFabric.GRPCAddress)
	// if err != nil {
	// 	logrus.WithError(err).Fatal("Failed to create Trust Fabric gRPC client")
	// }

	// Create and start the P2P node
	p2pNode, err := p2p.NewNode(ctx, &cfg.Node)
	if err != nil {
		logrus.WithError(err).Fatal("Failed to create P2P node")
	}
	logrus.Info("P2P Node created successfully")

	// Bootstrap the DHT
	if err := p2pNode.Bootstrap(ctx); err != nil {
		logrus.WithError(err).Fatal("Failed to bootstrap P2P node")
	}

	// Create and start the gRPC server (it sets its own stream handler on the libp2p host)
	grpcServer := grpc.NewServer(p2pNode)
	grpcServer.Serve() // This call is non-blocking and sets up stream handlers.

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	logrus.Info("Shutting down Mesh Node...")
	grpcServer.GracefulStop()
	p2pNode.Close()
	cancel()
	logrus.Info("Mesh Node shut down successfully.")
}