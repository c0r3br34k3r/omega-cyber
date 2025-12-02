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

package grpc

import (
	"context"
	"fmt"
	"io"

	"github.com/omega-cyber/mesh-network/gen/proto/go/mesh"
	"github.com/omega-cyber/mesh-network/internal/p2p"
	"github.com/sirupsen/logrus"
	"github.com/libp2p/go-libp2p-core/peer"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

const MeshProtocolID = "/omega/mesh/1.0.0"

// Server is the gRPC server for the MeshService.
type Server struct {
	mesh.UnimplementedMeshServiceServer
	node         *p2p.Node
	grpcServer   *grpc.Server
	healthServer *health.Server
}

// NewServer creates a new gRPC server.
func NewServer(node *p2p.Node) *Server {
	s := &Server{
		node:         node,
		grpcServer:   grpc.NewServer(),
		healthServer: health.NewServer(),
	}

	// Register the MeshService server and the health server.
	mesh.RegisterMeshServiceServer(s.grpcServer, s)
	healthpb.RegisterHealthServer(s.grpcServer, s.healthServer)

	// Enable reflection for gRPCurl and similar tools.
	reflection.Register(s.grpcServer)

	// Set the serving status for the health check.
	s.healthServer.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)

	return s
}

// Serve starts the gRPC server. In this libp2p context, it doesn't listen on a TCP
// socket but instead sets a stream handler on the libp2p host.
func (s *Server) Serve() {
	s.node.Host.SetStreamHandler(MeshProtocolID, s.node.WrapGRPC(s.grpcServer))
	logrus.Info("gRPC server is ready to handle streams on protocol: ", MeshProtocolID)
}

// GracefulStop stops the gRPC server.
func (s *Server) GracefulStop() {
	logrus.Info("Stopping gRPC server...")
	s.grpcServer.GracefulStop()
	s.healthServer.Shutdown()
}

// --- MeshServiceServer Implementation ---

// RegisterAgent handles agent registration. (Placeholder)
func (s *Server) RegisterAgent(ctx context.Context, req *mesh.RegisterAgentRequest) (*mesh.RegisterAgentResponse, error) {
	logrus.Infof("gRPC: Received RegisterAgent request from agent: %s", req.AgentId)
	// TODO: Integrate with Trust Fabric to validate the agent's public key.
	return &mesh.RegisterAgentResponse{
		Success:     true,
		Message:     fmt.Sprintf("Agent %s registered successfully", req.AgentId),
		SessionInfo: []byte("mock-session-token"),
	}, nil
}

// StreamTelemetry handles bi-directional streaming of telemetry and commands.
func (s *Server) StreamTelemetry(stream mesh.MeshService_StreamTelemetryServer) error {
	peerID, err := peer.IDFromBytes([]byte(stream.Context().Value("peerid").(string)))
	if err != nil {
		return fmt.Errorf("could not get peer id from stream context: %w", err)
	}
	logrus.Infof("gRPC: Opened telemetry stream from peer: %s", peerID.Pretty())

	for {
		// Receive telemetry data from the agent.
		telemetry, err := stream.Recv()
		if err == io.EOF {
			logrus.Infof("gRPC: Telemetry stream closed by peer: %s", peerID.Pretty())
			return nil
		}
		if err != nil {
			logrus.WithError(err).Warnf("Error receiving telemetry from peer: %s", peerID.Pretty())
			return err
		}

		logrus.Debugf("gRPC: Received telemetry from %s: Type=%s", telemetry.AgentId, telemetry.Type)

		// TODO: Process telemetry data (e.g., forward to Intelligence Core via Kafka).
	}
}

// GetPeerInfo retrieves information about a specific peer. (Placeholder)
func (s *Server) GetPeerInfo(ctx context.Context, req *mesh.GetPeerInfoRequest) (*mesh.GetPeerInfoResponse, error) {
	logrus.Infof("gRPC: Received GetPeerInfo request for peer: %s", req.PeerId)
	// TODO: Get actual peer info from the p2p node's peer store.
	return &mesh.GetPeerInfoResponse{
		Peer: &mesh.PeerInfo{
			Id:        req.PeerId,
			Addresses: []string{"/ip4/127.0.0.1/tcp/4001"},
			Status:    mesh.PeerInfo_ONLINE,
		},
	}, nil
}