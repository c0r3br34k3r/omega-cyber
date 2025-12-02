/**
 * =============================================================================
 * OMEGA PLATFORM - THREAT INTELLIGENCE DATA MODEL & MOCKS
 * =============================================================================
 *
 * This file defines the canonical TypeScript data structures for all entities
 * related to threat intelligence, including threats, IOCs, actors, and CVEs.
 *
 */

// --- §1. Type Definitions & Enums ---

export enum ThreatSeverity {
  CRITICAL = 'Critical',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
  INFO = 'Info',
}

export enum ThreatStatus {
  NEW = 'New',
  ACKNOWLEDGED = 'Acknowledged',
  IN_PROGRESS = 'In Progress',
  CONTAINED = 'Contained',
  RESOLVED = 'Resolved',
  FALSE_POSITIVE = 'False Positive',
}

export enum IOCType {
  HASH_SHA256 = 'SHA256 Hash',
  IP_ADDRESS = 'IP Address',
  DOMAIN_NAME = 'Domain Name',
  URL = 'URL',
  FILE_PATH = 'File Path',
}

export interface IndicatorOfCompromise {
  type: IOCType;
  value: string;
  firstSeen: number; // Unix timestamp
  lastSeen: number; // Unix timestamp
}

export interface Threat {
  id: string;
  severity: ThreatSeverity;
  status: ThreatStatus;
  type: 'Malware' | 'Phishing' | 'Intrusion' | 'DataExfil' | 'VulnerabilityExploit';
  timestamp: number;
  summary: string;
  relatedTTPs: string[]; // MITRE ATT&CK
  iocs: IndicatorOfCompromise[];
  attributedActorId?: string;
}

export interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  origin: string;
  motivations: ('FINANCIAL' | 'ESPIONAGE' | 'DESTRUCTION' | 'HACKTIVISM')[];
  knownTTPs: string[];
  description: string;
}

// --- §2. Mock Data ---

export const MOCK_THREAT_ACTORS: ThreatActor[] = [
  {
    id: 'apt-c-35',
    name: 'Shadow Weavers',
    aliases: ['Silent Cobra', 'Wizengamot'],
    origin: 'Unknown',
    motivations: ['FINANCIAL', 'ESPIONAGE'],
    knownTTPs: ['T1566', 'T1059.001', 'T1204', 'T1486'],
    description: 'A sophisticated actor known for using custom ransomware and targeting financial institutions.'
  },
  {
    id: 'apt-g-12',
    name: 'GhostNet',
    aliases: ['Red Specter'],
    origin: 'State-Sponsored',
    motivations: ['ESPIONAGE', 'DESTRUCTION'],
    knownTTPs: ['T1588', 'T1547', 'T1071.001'],
    description: 'A highly persistent actor focused on long-term infiltration of government and defense networks.'
  }
];

export const MOCK_THREATS: Threat[] = [
  {
    id: 'thr-8912',
    severity: ThreatSeverity.CRITICAL,
    status: ThreatStatus.NEW,
    type: 'Ransomware',
    timestamp: Date.now(),
    summary: 'Epsilon-variant ransomware deployed on "FINANCE-DB-01". Encryption in progress.',
    relatedTTPs: ['T1486', 'T1059.001'],
    iocs: [
      { type: IOCType.HASH_SHA256, value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', firstSeen: Date.now(), lastSeen: Date.now() },
      { type: IOCType.IP_ADDRESS, value: '172.16.254.1', firstSeen: Date.now() - 10000, lastSeen: Date.now() }
    ],
    attributedActorId: 'apt-c-35',
  },
  {
    id: 'thr-8911',
    severity: ThreatSeverity.HIGH,
    status: ThreatStatus.NEW,
    type: 'Intrusion',
    timestamp: Date.now() - 20000,
    summary: 'Anomalous login to "core-eu-west-1" from a suspicious IP.',
    relatedTTPs: ['T1078', 'T1021'],
    iocs: [
      { type: IOCType.IP_ADDRESS, value: '103.27.104.99', firstSeen: Date.now() - 20000, lastSeen: Date.now() - 20000 }
    ],
  },
  {
    id: 'thr-8910',
    severity: ThreatSeverity.MEDIUM,
    status: ThreatStatus.ACKNOWLEDGED,
    type: 'Phishing',
    timestamp: Date.now() - 120000,
    summary: 'Phishing email containing a malicious link sent to multiple users.',
    relatedTTPs: ['T1566.002'],
    iocs: [
      { type: IOCType.URL, value: 'http://secure-login-update.com/omega', firstSeen: Date.now() - 120000, lastSeen: Date.now() - 120000 }
    ],
    attributedActorId: 'apt-c-35',
  }
];

// --- §3. Initial State ---

export const getInitialThreatIntelState = () => ({
  threats: MOCK_THREATS,
  actors: MOCK_THREAT_ACTORS,
  selectedThreatId: MOCK_THREATS[0].id,
  isLoading: false,
});