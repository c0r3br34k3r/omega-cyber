/**
 * =============================================================================
 * OMEGA PLATFORM - SIMULATION OUTPUTS DATA MODEL & MOCKS
 * =============================================================================
 *
 * This file defines the canonical TypeScript data structures for the inputs and
 * outputs of the cybernetic simulation engine.
 *
 */

// --- §1. Type Definitions & Enums ---

export enum SimulationStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export enum DefensePosture {
  PASSIVE = 'Passive',
  BALANCED = 'Balanced',
  AGGRESSIVE = 'Aggressive',
}

export interface SimulationParameters {
  scenarioId: string;
  defensePosture: DefensePosture;
  attackerCount: number;
  networkLatencyVariance: number; // percentage
}

export type TimelineEventType = 'BREACH' | 'DETECTION' | 'RESPONSE' | 'COMPROMISE' | 'INFO';

export interface TimelineEvent {
  timestamp: number; // Unix timestamp (ms)
  type: TimelineEventType;
  description: string;
  impactScore: number; // 0-10
  subjectNodeId?: string;
}

export interface SimulationKPIs {
  meanTimeToDetection: number; // seconds
  meanTimeToResponse: number; // seconds
  systemIntegrity: number; // percentage
  assetsCompromised: number;
}

export interface AIRecommendation {
  recommendationId: string;
  priority: 'Critical' | 'High' | 'Medium';
  title: string;
  description: string;
  relatedTTPs: string[]; // MITRE ATT&CK TTPs
}

export interface SimulationResult {
  simulationId: string;
  finalScore: number; // Overall defense score
  summary: string;
  fullTimeline: TimelineEvent[];
  finalKPIs: SimulationKPIs;
  recommendations: AIRecommendation[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
}

// --- §2. Mock Data ---

export const MOCK_SCENARIOS: SimulationScenario[] = [
  { id: 'scn_01', name: 'DDoS on Core Services', description: 'Simulates a large-scale volumetric attack on API gateways.' },
  { id: 'scn_02', name: 'Ransomware Propagation', description: 'Models the spread of an Epsilon-variant ransomware from a compromised endpoint.' },
  { id: 'scn_03', name: 'Insider Threat: Data Exfiltration', description: 'A privileged user attempts to exfiltrate sensitive data over encrypted channels.' },
];

export const MOCK_COMPLETED_RESULT: SimulationResult = {
  simulationId: 'sim-a9f8e7d6',
  finalScore: 78,
  summary: 'The attack was successfully contained, but initial detection was slow, leading to the temporary compromise of one non-critical asset. The AI defense posture was effective in quarantining the threat.',
  fullTimeline: [
    { timestamp: Date.now() - 60000, type: 'BREACH', description: 'Initial breach via spear-phishing on sentinel-ny-finance.', impactScore: 7, subjectNodeId: 'sentinel-ny-finance' },
    { timestamp: Date.now() - 45000, type: 'DETECTION', description: 'Anomalous network traffic detected by Intelligence Core.', impactScore: 2, subjectNodeId: 'core-us-east-1' },
    { timestamp: Date.now() - 30000, type: 'COMPROMISE', description: 'Asset "marketing-db" compromised.', impactScore: 8, subjectNodeId: 'marketing-db' },
    { timestamp: Date.now() - 25000, type: 'RESPONSE', description: 'Sentinel agent isolated the compromised asset.', impactScore: 3, subjectNodeId: 'sentinel-ny-finance' },
  ],
  finalKPIs: {
    meanTimeToDetection: 15,
    meanTimeToResponse: 5,
    systemIntegrity: 98.5,
    assetsCompromised: 1,
  },
  recommendations: [
    {
      recommendationId: 'rec-001',
      priority: 'High',
      title: 'Enhance Phishing Detection Training',
      description: 'The initial breach vector was social engineering. Recommend enhanced, targeted training for users with access to critical systems.',
      relatedTTPs: ['T1566'],
    },
    {
      recommendationId: 'rec-002',
      priority: 'Medium',
      title: 'Review Firewall Rules for Subnet C',
      description: 'Lateral movement was attempted towards Subnet C. Review egress and ingress rules to further segment the network.',
      relatedTTPs: ['T1021'],
    },
  ],
};

// --- §3. Utility Functions ---

export const getInitialSimulationState = (): {
  status: SimulationStatus;
  activeScenario: string | null;
  parameters: SimulationParameters;
  results: SimulationResult | null;
} => ({
  status: SimulationStatus.IDLE,
  activeScenario: MOCK_SCENARIOS[0].id,
  parameters: {
    scenarioId: MOCK_SCENARIOS[0].id,
    defensePosture: DefensePosture.BALANCED,
    attackerCount: 10,
    networkLatencyVariance: 5,
  },
  results: null,
});