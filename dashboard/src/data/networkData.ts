/**
 * =============================================================================
 * OMEGA PLATFORM - NETWORK DATA MODEL & MOCKS
 * =============================================================================
 *
 * This file defines the canonical TypeScript data structures for the mesh network
 * and provides realistic mock data for development and testing.
 *
 */

// --- §1. Type Definitions & Enums ---

export enum NodeCategory {
  INTELLIGENCE_CORE = 'Intelligence Core',
  MESH_NODE = 'Mesh Node',
  SENTINEL_AGENT = 'Sentinel Agent',
  DIGITAL_TWIN = 'Digital Twin',
  ORCHESTRATOR = 'Orchestrator',
  DECEPTION_NODE = 'Deception Node',
}

export enum NodeStatus {
  ONLINE = 'Online',
  OFFLINE = 'Offline',
  DEGRADED = 'Degraded',
  UNDER_ATTACK = 'Under Attack',
}

export interface NodeMetrics {
  cpuUsage: number; // percentage
  memUsage: number; // percentage
  diskUsage: number; // percentage
  uptime: number; // seconds
}

export interface GeoLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface NetworkNode {
  id: string; // e.g., 'core-us-east-1'
  name: string;
  category: NodeCategory;
  status: NodeStatus;
  ipAddress: string;
  location: GeoLocation;
  metrics: NodeMetrics;
}

export interface NetworkLink {
  source: string; // Source Node ID
  target: string; // Target Node ID
  latency: number; // milliseconds
  bandwidth: number; // Mbps
  protocol: 'gRPC' | 'QUIC' | 'WSS'; // Web-friendly protocols
}

// --- §2. Mock Data Generation ---

export const MOCK_NODES: NetworkNode[] = [
  {
    id: 'core-us-east-1',
    name: 'Primary Intelligence Core',
    category: NodeCategory.INTELLIGENCE_CORE,
    status: NodeStatus.ONLINE,
    ipAddress: '74.125.224.72',
    location: { city: 'Ashburn', country: 'USA', lat: 39.0438, lon: -77.4874 },
    metrics: { cpuUsage: 75, memUsage: 80, diskUsage: 60, uptime: 1234567 },
  },
  {
    id: 'core-eu-west-1',
    name: 'European Intelligence Core',
    category: NodeCategory.INTELLIGENCE_CORE,
    status: NodeStatus.ONLINE,
    ipAddress: '35.180.128.1',
    location: { city: 'Dublin', country: 'Ireland', lat: 53.3498, lon: -6.2603 },
    metrics: { cpuUsage: 68, memUsage: 75, diskUsage: 55, uptime: 1234000 },
  },
  {
    id: 'mesh-tokyo-1',
    name: 'Mesh Relay TYO-01',
    category: NodeCategory.MESH_NODE,
    status: NodeStatus.DEGRADED,
    ipAddress: '106.14.38.117',
    location: { city: 'Tokyo', country: 'Japan', lat: 35.6895, lon: 139.6917 },
    metrics: { cpuUsage: 92, memUsage: 88, diskUsage: 70, uptime: 897654 },
  },
  {
    id: 'sentinel-ny-finance',
    name: 'Sentinel Agent (NY Finance)',
    category: NodeCategory.SENTINEL_AGENT,
    status: NodeStatus.UNDER_ATTACK,
    ipAddress: '192.168.1.101',
    location: { city: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060 },
    metrics: { cpuUsage: 99, memUsage: 95, diskUsage: 40, uptime: 456789 },
  },
  {
    id: 'sentinel-frankfurt-dc',
    name: 'Sentinel Agent (Frankfurt DC)',
    category: NodeCategory.SENTINEL_AGENT,
    status: NodeStatus.ONLINE,
    ipAddress: '192.168.2.55',
    location: { city: 'Frankfurt', country: 'Germany', lat: 50.1109, lon: 8.6821 },
    metrics: { cpuUsage: 30, memUsage: 45, diskUsage: 30, uptime: 1122334 },
  },
  {
    id: 'digital-twin-sim-1',
    name: 'Digital Twin Simulation Environment',
    category: NodeCategory.DIGITAL_TWIN,
    status: NodeStatus.OFFLINE,
    ipAddress: '10.0.0.5',
    location: { city: 'Localhost', country: 'N/A', lat: 0, lon: 0 },
    metrics: { cpuUsage: 0, memUsage: 0, diskUsage: 0, uptime: 0 },
  },
];

export const MOCK_LINKS: NetworkLink[] = [
    { source: 'core-us-east-1', target: 'core-eu-west-1', latency: 75, bandwidth: 1000, protocol: 'QUIC' },
    { source: 'core-us-east-1', target: 'mesh-tokyo-1', latency: 180, bandwidth: 500, protocol: 'QUIC' },
    { source: 'core-eu-west-1', target: 'mesh-tokyo-1', latency: 250, bandwidth: 400, protocol: 'QUIC' },
    { source: 'core-us-east-1', target: 'sentinel-ny-finance', latency: 5, bandwidth: 100, protocol: 'gRPC' },
    { source: 'core-eu-west-1', target: 'sentinel-frankfurt-dc', latency: 8, bandwidth: 100, protocol: 'gRPC' },
    { source: 'mesh-tokyo-1', target: 'sentinel-frankfurt-dc', latency: 260, bandwidth: 50, protocol: 'WSS' },
    { source: 'core-us-east-1', target: 'digital-twin-sim-1', latency: 1, bandwidth: 10000, protocol: 'gRPC' }
];

// --- §3. Utility Functions ---

/**
 * Returns the initial state for the network slice in Redux.
 */
export const getInitialNetworkState = () => ({
  nodes: MOCK_NODES,
  links: MOCK_LINKS,
  metrics: {
    totalNodes: MOCK_NODES.length,
    onlineNodes: MOCK_NODES.filter(n => n.status !== NodeStatus.OFFLINE).length,
    totalBandwidth: MOCK_LINKS.reduce((acc, link) => acc + link.bandwidth, 0),
  }
});