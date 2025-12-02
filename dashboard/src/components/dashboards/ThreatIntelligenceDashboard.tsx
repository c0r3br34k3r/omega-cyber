import React, { useState } from 'react';
import {
  Box, Paper, Typography, List, ListItemButton, ListItemText, Divider,
  Chip, Tabs, Tab, Button, Tooltip
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { Header } from '../layout/Header';
import { GppGood, GppMaybe, HelpOutline } from '@mui/icons-material';

// --- FAKE DATA & MOCKS ---
const fakeThreats = [
  { id: 'thr-8912', severity: 'Critical', type: 'Ransomware', timestamp: '2025-11-30T10:00:00Z', status: 'New' },
  { id: 'thr-8911', severity: 'High', type: 'Intrusion', timestamp: '2025-11-30T09:58:12Z', status: 'New' },
  { id: 'thr-8910', severity: 'Medium', type: 'Phishing', timestamp: '2025-11-30T09:55:03Z', status: 'Acknowledged' },
  { id: 'thr-8909', severity: 'Low', type: 'Malware', timestamp: '2025-11-30T09:54:00Z', status: 'Closed' },
];

const fakeThreatDetail = {
  id: 'thr-8912',
  summary: 'AI core has identified Epsilon-variant ransomware activity originating from IP 172.16.254.1, targeting critical asset "FINANCE-DB-01".',
  ttps: ['T1486', 'T1059.001', 'T1562.001'],
  sourceIp: '172.16.254.1',
  targetAsset: 'FINANCE-DB-01',
};

const severityColors: { [key: string]: "error" | "warning" | "info" | "success" } = {
  'Critical': 'error',
  'High': 'warning',
  'Medium': 'info',
  'Low': 'success',
};

// --- Main Component ---
const ThreatIntelligenceDashboard: React.FC = () => {
  const [selectedThreat, setSelectedThreat] = useState(fakeThreatDetail);
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Box className="h-full flex flex-col p-4 space-y-4">
      <Header title="Threat Intelligence Hub" description="Triage, analyze, and respond to active threats." />

      <Box className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-150px)]">
        {/* === Incoming Threats List === */}
        <Paper className="card lg:col-span-3 h-full overflow-y-auto">
           <Typography variant="h6" className="!mb-4">Incoming Threats</Typography>
           <div className="ag-theme-alpine-dark" style={{ height: '90%', width: '100%' }}>
              <AgGridReact
                  rowData={fakeThreats}
                  columnDefs={[
                    { field: 'severity', flex: 1, cellRenderer: (p: any) => <Chip label={p.value} color={severityColors[p.value]} size="small"/> },
                    { field: 'type', flex: 1 },
                    { field: 'timestamp', flex: 1, sort: 'desc' },
                  ]}
                  onRowClicked={(row) => setSelectedThreat(fakeThreatDetail)}
                  suppressCellFocus={true}
              />
           </div>
        </Paper>

        {/* === Threat Detail View === */}
        <Paper className="card lg:col-span-5 h-full flex flex-col">
          <Box className="flex justify-between items-center">
             <Typography variant="h5">{selectedThreat.id}</Typography>
             <Chip label="NEEDS TRIAGE" color="error" />
          </Box>
          <Divider className="!my-4" />
          <Typography variant="body1" className="italic mb-4">"{selectedThreat.summary}"</Typography>
          <Typography variant="subtitle2" gutterBottom>MITRE ATT&CK TTPs</Typography>
          <Box className="flex flex-wrap gap-2 mb-4">
            {selectedThreat.ttps.map(ttp => <Chip key={ttp} label={ttp} variant="outlined" size="small" />)}
          </Box>
          <Box flexGrow={1} />
          <Box className="flex gap-2 mt-4">
            <Button variant="contained" color="primary" startIcon={<GppGood />}>Acknowledge & Monitor</Button>
            <Button variant="outlined" color="secondary">Mark as False Positive</Button>
          </Box>
        </Paper>

        {/* === Contextual Intelligence Panel === */}
        <Paper className="card lg:col-span-4 h-full">
            <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth">
                <Tab label="Threat Actor" />
                <Tab label="Affected Asset" />
                <Tab label="Vulnerability" />
            </Tabs>
            {tabIndex === 0 && <Box className="p-4"><Typography variant="h6">APT-C-35 ("Shadow Weavers")</Typography><Typography>Known for financial motivations and using custom ransomware...</Typography></Box>}
            {tabIndex === 1 && <Box className="p-4"><Typography variant="h6">FINANCE-DB-01</Typography><Typography>Critical financial database containing customer PII.</Typography></Box>}
            {tabIndex === 2 && <Box className="p-4"><Typography variant="h6">CVE-2025-12345</Typography><Typography>Remote code execution vulnerability in Apache Struts.</Typography></Box>}
        </Paper>
      </Box>
    </Box>
  );
};

export default ThreatIntelligenceDashboard;
