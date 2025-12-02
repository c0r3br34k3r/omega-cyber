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

package p2p_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/omega-cyber/mesh-network/internal/config"
	"github.com/omega-cyber/mesh-network/internal/p2p"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewNode(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := &config.NodeConfig{
		ID:       "test-node",
		P2PPort:  0, // Let OS assign a random port
		GRPCPort: 0,
	}

	node, err := p2p.NewNode(ctx, cfg)
	require.NoError(t, err)
	assert.NotNil(t, node)
	assert.NotNil(t, node.Host)
	assert.NotEmpty(t, node.Host.ID().Pretty())
	assert.GreaterOrEqual(t, len(node.Host.Addrs()), 1)

	err = node.Close()
	assert.NoError(t, err)
}

func TestNodeBootstrap(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create a bootstrap node
	bootstrapCfg := &config.NodeConfig{
		ID:       "bootstrap-node",
		P2PPort:  0, // Let OS assign a random port
		GRPCPort: 0,
	}
	bootstrapNode, err := p2p.NewNode(ctx, bootstrapCfg)
	require.NoError(t, err)
	defer bootstrapNode.Close()

	// Bootstrap the bootstrap node itself (it should just initialize its DHT)
	err = bootstrapNode.Bootstrap(ctx)
	require.NoError(t, err)

	// Get the multiaddr of the bootstrap node to use as a join address
	bootstrapAddr := fmt.Sprintf("%s/p2p/%s", bootstrapNode.Host.Addrs()[0].String(), bootstrapNode.Host.ID().Pretty())

	// Create a second node that joins the bootstrap node
	joinCfg := &config.NodeConfig{
		ID:            "join-node",
		P2PPort:       0, // Let OS assign a random port
		GRPCPort:      0,
		JoinAddresses: []string{bootstrapAddr},
	}
	joinNode, err := p2p.NewNode(ctx, joinCfg)
	require.NoError(t, err)
	defer joinNode.Close()

	err = joinNode.Bootstrap(ctx)
	require.NoError(t, err)

	// Give some time for DHT discovery to propagate
	time.Sleep(5 * time.Second)

	// Verify that joinNode can find bootstrapNode in its DHT
	peerFound, err := joinNode.Host.Routing().(*dht.IpfsDHT).FindPeer(ctx, bootstrapNode.Host.ID())
	assert.NoError(t, err)
	assert.Equal(t, bootstrapNode.Host.ID(), peerFound.ID)

	// Verify that bootstrapNode can find joinNode in its DHT (optional, but good for full connectivity)
	peerFound2, err := bootstrapNode.Host.Routing().(*dht.IpfsDHT).FindPeer(ctx, joinNode.Host.ID())
	assert.NoError(t, err)
	assert.Equal(t, joinNode.Host.ID(), peerFound2.ID)

	// Test that DHT routing table size increases
	assert.GreaterOrEqual(t, joinNode.Host.Routing().(*dht.IpfsDHT).RoutingTable().Size(), 1)
	assert.GreaterOrEqual(t, bootstrapNode.Host.Routing().(*dht.IpfsDHT).RoutingTable().Size(), 1)
}
