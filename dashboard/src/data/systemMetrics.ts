/**
 * =============================================================================
 * OMEGA PLATFORM - SYSTEM METRICS DATA MODEL & MOCKS
 * =============================================================================
 *
 * This file defines the canonical TypeScript data structures for global system
 * health and provides dynamic mock data generators for development.
 *
 */

// --- §1. Type Definitions & Enums ---

export enum GlobalStatus {
  OPERATIONAL = 'All Systems Operational',
  DEGRADED = 'Degraded Performance',
  PARTIAL_OUTAGE = 'Partial Outage',
  CRITICAL = 'Critical Alert',
}

export interface ModuleHealth {
  id: string; // e.g., 'intelligence-core'
  name: string;
  status: 'Online' | 'Offline' | 'Error';
  cpu: number; // percentage
  memory: number; // percentage
}

export interface GlobalMetrics {
  globalStatus: GlobalStatus;
  platformCpuLoad: number;
  platformMemoryUsage: number;
  meshThroughput: number; // Gbps
  activeSentinels: number;
  totalSentinels: number;
  trustFabricTps: number; // Transactions Per Second
}

export interface TimePoint {
  timestamp: number;
  value: number;
}

export interface TimeSeriesData {
  cpuHistory: TimePoint[];
  memoryHistory: TimePoint[];
  networkIngressHistory: TimePoint[];
  networkEgressHistory: TimePoint[];
}

// --- §2. Mock Data Generators ---
// These functions create dynamic, realistic-looking data for development.

/**
 * Generates health data for all major Omega modules.
 */
export const generateModuleHealth = (): ModuleHealth[] => ([
  { id: 'intelligence-core', name: 'Intelligence Core', status: 'Online', cpu: 60 + Math.random() * 15, memory: 70 + Math.random() * 10 },
  { id: 'mesh-network', name: 'Mesh Network', status: 'Online', cpu: 40 + Math.random() * 10, memory: 50 + Math.random() * 5 },
  { id: 'trust-fabric', name: 'Trust Fabric', status: 'Online', cpu: 25 + Math.random() * 5, memory: 30 + Math.random() * 5 },
  { id: 'digital-twin', name: 'Digital Twin', status: Math.random() > 0.9 ? 'Error' : 'Online', cpu: 80 + Math.random() * 10, memory: 85 + Math.random() * 5 },
  { id: 'orchestration', name: 'Orchestration', status: 'Online', cpu: 15 + Math.random() * 5, memory: 20 + Math.random() * 5 },
  { id: 'deception-engine', name: 'Deception Engine', status: 'Online', cpu: 20 + Math.random() * 5, memory: 25 + Math.random() * 5 },
]);

/**
 * Generates a snapshot of global metrics.
 */
export const generateGlobalMetrics = (): GlobalMetrics => {
  const cpu = 50 + Math.random() * 25;
  const status = cpu > 85 ? GlobalStatus.CRITICAL : cpu > 70 ? GlobalStatus.DEGRADED : GlobalStatus.OPERATIONAL;
  return {
    globalStatus: status,
    platformCpuLoad: cpu,
    platformMemoryUsage: 60 + Math.random() * 20,
    meshThroughput: 5 + Math.random() * 5,
    activeSentinels: 140 + Math.floor(Math.random() * 10),
    totalSentinels: 150,
    trustFabricTps: 800 + Math.floor(Math.random() * 400),
  };
};

/**
 * Generates a random walk time-series.
 * @param points The number of data points to generate.
 * @param initialValue The starting value.
 * @param max The maximum value.
 * @param volatility How much the value can change per step.
 */
const generateRandomWalk = (points: number, initialValue: number, max: number, volatility: number): TimePoint[] => {
  const data: TimePoint[] = [];
  let lastValue = initialValue;
  const now = Date.now();
  for (let i = 0; i < points; i++) {
    data.push({ timestamp: now - (points - i - 1) * 5000, value: lastValue });
    const change = (Math.random() - 0.5) * volatility;
    lastValue = Math.max(0, Math.min(max, lastValue + change));
  }
  return data;
};

/**
 * Generates a full set of time-series data for charts.
 */
export const generateTimeSeriesData = (points: number = 60): TimeSeriesData => ({
  cpuHistory: generateRandomWalk(points, 65, 100, 5),
  memoryHistory: generateRandomWalk(points, 70, 100, 3),
  networkIngressHistory: generateRandomWalk(points, 500, 1000, 200),
  networkEgressHistory: generateRandomWalk(points, 200, 1000, 150),
});

// --- §3. Initial State ---

export const getInitialSystemState = () => ({
  globalMetrics: generateGlobalMetrics(),
  moduleHealth: generateModuleHealth(),
  timeSeries: generateTimeSeriesData(),
});