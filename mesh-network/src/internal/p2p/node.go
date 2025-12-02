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

package p2p

import (
	"context"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/omega-cyber/mesh-network/internal/config"
	"github.com/sirupsen/logrus"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p-core/crypto"
	"github.com/libp2p/go-libp2p-core/host"
	"github.com/libp2p/go-libp2p-core/network"
	"github.com/libp2p/go-libp2p-core/peer"
	"github.com/libp2p/go-libp2p-core/routing"
	dht "github.com/libp2p/go-libp2p-kad-dht"
	quic "github.com/libp2p/go-libp2p-quic-transport"
	"github.com/multiformats/go-multiaddr"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Node represents a libp2p node in the Omega mesh network.
type Node struct {
	Host host.Host
	dht  *dht.IpfsDHT
	cfg  *config.NodeConfig
}

// NewNode creates and initializes a new libp2p node.
func NewNode(ctx context.Context, cfg *config.NodeConfig) (*Node, error) {
	// Generate a new key pair for this node.
	// In a real application, this would be loaded from a secure store.
	priv, _, err := crypto.GenerateKeyPair(crypto.Ed25519, -1)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key pair: %w", err)
	}

	// Create the libp2p host.
	h, err := libp2p.New(
		// Use the generated key pair.
		libp2p.Identity(priv),
		// Listen on a QUIC transport.
		libp2p.Transport(quic.NewTransport),
		// Listen on all available interfaces and a specific port.
		libp2p.ListenAddrStrings(
			fmt.Sprintf("/ip4/0.0.0.0/udp/%d/quic", cfg.P2PPort),
			fmt.Sprintf("/ip6/::/udp/%d/quic", cfg.P2PPort),
		),
		// Use a NAT traversal solution.
		libp2p.NATPortMap(),
		// Enable the DHT for peer discovery.
		libp2p.Routing(func(h host.Host) (routing.PeerRouting, error) {
			var err error
			kadDHT, err := dht.New(ctx, h)
			return kadDHT, err
		}),
		// Let's prevent our peer from having too many open connections.
		libp2p.ConnectionManager(nil), // TODO: Configure this properly
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create libp2p host: %w", err)
	}

	node := &Node{
		Host: h,
		cfg:  cfg,
	}

	// Extract the DHT from the host.
	node.dht = h.Routing().(*dht.IpfsDHT)

	logrus.Infof("P2P Node created with ID: %s", h.ID().Pretty())
	for _, addr := range h.Addrs() {
		logrus.Infof("Listening on: %s", addr.String())
	}

	return node, nil
}

// Bootstrap connects to a set of bootstrap peers and initializes the DHT.
func (n *Node) Bootstrap(ctx context.Context) error {
	var wg sync.WaitGroup
	var connectedPeers int

	bootstrapPeers := dht.DefaultBootstrapPeers
	if len(n.cfg.JoinAddresses) > 0 {
		peers, err := parsePeers(n.cfg.JoinAddresses)
		if err != nil {
			logrus.WithError(err).Warn("Failed to parse custom bootstrap peers, using defaults.")
		} else {
			bootstrapPeers = peers
		}
	}

	logrus.Info("Bootstrapping DHT...")
	for _, p := range bootstrapPeers {
		wg.Add(1)
		go func(p peer.AddrInfo) {
			defer wg.Done()
			logrus.Infof("Connecting to bootstrap peer: %s", p.ID.Pretty())
			if err := n.Host.Connect(ctx, p); err != nil {
				logrus.WithError(err).Warnf("Failed to connect to bootstrap peer: %s", p.ID.Pretty())
			} else {
				logrus.Infof("Connected to bootstrap peer: %s", p.ID.Pretty())
				connectedPeers++
			}
		}(p)
	}
	wg.Wait()

	if connectedPeers == 0 && len(bootstrapPeers) > 0 {
		return fmt.Errorf("could not connect to any bootstrap peers")
	}

	// We're connected to our bootstrap peers, now bootstrap the DHT.
	if err := n.dht.Bootstrap(ctx); err != nil {
		return fmt.Errorf("failed to bootstrap DHT: %w", err)
	}

	// Periodically print routing table stats.
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				logrus.Infof("DHT Routing Table Size: %d", n.dht.RoutingTable().Size())
			}
		}
	}()

	return nil
}

// Close gracefully shuts down the libp2p node.
func (n *Node) Close() error {
	logrus.Info("Closing P2P Node...")
	return n.Host.Close()
}

// --- Helper for gRPC over libp2p ---

// lp2pStreamConn is a net.Conn implementation that wraps a libp2p stream.
type lp2pStreamConn struct {
	network.Stream
}

// Read reads data from the libp2p stream.
func (c *lp2pStreamConn) Read(b []byte) (n int, err error) {
	return c.Stream.Read(b)
}

// Write writes data to the libp2p stream.
func (c *lp2pStreamConn) Write(b []byte) (n int, err error) {
	return c.Stream.Write(b)
}

// Close closes the libp2p stream.
func (c *lp2pStreamConn) Close() error {
	return c.Stream.Close()
}

// LocalAddr returns the local Multiaddr.
func (c *lp2pStreamConn) LocalAddr() net.Addr {
	return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0} // Placeholder
}

// RemoteAddr returns the remote Multiaddr.
func (c *lp2pStreamConn) RemoteAddr() net.Addr {
	return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0} // Placeholder
}

// SetDeadline is not implemented for libp2p streams.
func (c *lp2pStreamConn) SetDeadline(t time.Time) error {
	return fmt.Errorf("SetDeadline not supported for libp2p streams")
}

// SetReadDeadline is not implemented for libp2p streams.
func (c *lp2pStreamConn) SetReadDeadline(t time.Time) error {
	return fmt.Errorf("SetReadDeadline not supported for libp2p streams")
}

// SetWriteDeadline is not implemented for libp2p streams.
func (c *lp2pStreamConn) SetWriteDeadline(t time.Time) error {
	return fmt.Errorf("SetWriteDeadline not supported for libp2p streams")
}

// WrapGRPC returns a stream handler function that can serve a gRPC server on a libp2p stream.
func (n *Node) WrapGRPC(grpcServer *grpc.Server) network.StreamHandler {
	return func(s network.Stream) {
		logrus.Debugf("Received new gRPC stream from %s, protocol %s", s.Conn().RemotePeer().Pretty(), s.Protocol())
		
		// Create a context for the gRPC stream.
		// Attach the remote peer ID to the context so gRPC services can access it.
		ctx := context.WithValue(s.Context(), "peerid", s.Conn().RemotePeer().String())

		// Serve the gRPC server on the libp2p stream wrapped as a net.Conn.
		go func() {
			grpcServer.Serve(newSingleUseListener(s))
		}()
	}
}

// singleUseListener is a net.Listener that can only accept one connection (a libp2p stream).
type singleUseListener struct {
	stream network.Stream
	once   sync.Once
}

func newSingleUseListener(stream network.Stream) *singleUseListener {
	return &singleUseListener{
		stream: stream,
	}
}

func (l *singleUseListener) Accept() (net.Conn, error) {
	var conn net.Conn
	var err error
	l.once.Do(func() {
		conn = &lp2pStreamConn{Stream: l.stream}
	})
	if conn != nil {
		return conn, nil
	}
	return nil, io.EOF // Already accepted once
}

func (l *singleUseListener) Close() error {
	return l.stream.Close()
}

func (l *singleUseListener) Addr() net.Addr {
	// Return a dummy address as libp2p streams don't have traditional net.Addrs
	return &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0}
}

func parsePeers(addrs []string) ([]peer.AddrInfo, error) {
	var peers []peer.AddrInfo
	for _, addrStr := range addrs {
		addr, err := multiaddr.NewMultiaddr(addrStr)
		if err != nil {
			return nil, err
		}
		pi, err := peer.AddrInfoFromP2pAddr(addr)
		if err != nil {
			return nil, err
		}
		peers = append(peers, *pi)
	}
	return peers, nil
}

// --- Client for gRPC over libp2p ---

// DialGRPC creates a gRPC client connection to a remote libp2p peer.
func (n *Node) DialGRPC(ctx context.Context, peerID peer.ID) (*grpc.ClientConn, error) {
	// Create a new stream to the remote peer using the gRPC protocol ID.
	stream, err := n.Host.NewStream(ctx, peerID, MeshProtocolID)
	if err != nil {
		return nil, fmt.Errorf("failed to open libp2p stream to peer %s: %w", peerID.Pretty(), err)
	}

	// Use grpc.NewClient with a custom DialOption that uses our stream.
	conn := &lp2pStreamConn{Stream: stream}
	return grpc.NewClient(
		"", // Target is ignored when using a custom DialOption
		grpc.WithTransportCredentials(insecure.NewCredentials()), // Or secure credentials if using TLS
		grpc.WithContextDialer(func(ctx context.Context, s string) (net.Conn, error) {
			// This dialer returns our already established libp2p stream as a net.Conn.
			return conn, nil
		}),
	), nil
}
