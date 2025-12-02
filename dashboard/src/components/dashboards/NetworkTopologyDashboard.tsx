import React, { useState, useMemo } from 'react';
import { Box, Paper, Typography, Button, List, ListItem, ListItemIcon, ListItemText, Divider, Chip } from '@mui/material';
import { Lan, Dns, Cable, Hub, Insights, Memory, Storage } from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';

import { useAppSelector } from '@/hooks/useRedux';
import { Header } from '../layout/Header';

// --- FAKE DATA (to be replaced by Redux state) ---
const fakeNodes = [
  { id: 'core-1', name: 'Intelligence Core 1', category: 0, value: 50, status: 'online' },
  { id: 'core-2', name: 'Intelligence Core 2', category: 0, value: 50, status: 'online' },
  { id: 'mesh-1', name: 'Mesh Node A (Go)', category: 1, value: 30, status: 'online' },
  { id: 'mesh-2', name: 'Mesh Node B (Go)', category: 1, value: 30, status: 'degraded' },
  { id: 'sentinel-a', name: 'Sentinel Agent (Rust)', category: 2, value: 10, status: 'online' },
  { id: 'sentinel-b', name: 'Sentinel Agent (C++)', category: 2, value: 10, status: 'offline' },
  { id: 'digital-twin', name: 'Digital Twin Bridge', category: 3, value: 40, status: 'online' },
];
const fakeLinks = [
  { source: 'core-1', target: 'mesh-1', value: 150 },
  { source: 'core-1', target: 'mesh-2', value: 80 },
  { source: 'core-2', target: 'mesh-1', value: 120 },
  { source: 'core-2', target: 'mesh-2', value: 95 },
  { source: 'mesh-1', target: 'sentinel-a', value: 20 },
  { source: 'mesh-2', target: 'sentinel-b', value: 5 },
  { source: 'core-1', target: 'digital-twin', value: 200 },
];
const categories = [{ name: 'Core' }, { name: 'Mesh' }, { name: 'Sentinel' }, { name: 'Simulation' }];
const statusColors: { [key: string]: string } = { online: '#22c55e', degraded: '#f97316', offline: '#ef4444' };

// --- Main Component ---
const NetworkTopologyDashboard: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<any | null>(fakeNodes[0]);
  const networkState = useAppSelector((state) => state.network); // Assuming a network slice exists

  const graphOptions = useMemo(() => ({
    tooltip: {},
    legend: [{ data: categories.map(a => a.name), textStyle: { color: '#ccc' } }],
    series: [
      {
        name: 'Omega Mesh Network',
        type: 'graph',
        layout: 'force',
        data: fakeNodes.map(node => ({ ...node, itemStyle: { color: statusColors[node.status] } })),
        links: fakeLinks.map(link => ({...link, lineStyle: { width: Math.max(1, link.value / 50) }})),
        categories: categories,
        roam: true,
        label: { show: true, position: 'right' },
        force: { repulsion: 200 },
      },
    ],
  }), [networkState]); // Dependency on Redux state

  const onChartClick = (params: any) => {
    if (params.dataType === 'node') {
      setSelectedNode(params.data);
    } else {
      setSelectedNode(null);
    }
  };

  const SelectedNodeDetails = () => (
    <Paper className="card h-full flex flex-col p-4">
      <Typography variant="h6" className="!mb-2">{selectedNode?.name || 'No Selection'}</Typography>
      {selectedNode ? (
        <>
          <Chip label={selectedNode.status.toUpperCase()} color={selectedNode.status === 'online' ? 'success' : (selectedNode.status === 'degraded' ? 'warning' : 'error')} size="small" className="!w-fit" />
          <Divider className="!my-4" />
          <List dense>
            <ListItem><ListItemIcon><Dns /></ListItemIcon><ListItemText primary="ID" secondary={selectedNode.id} /></ListItem>
            <ListItem><ListItemIcon><Hub /></ListItemIcon><ListItemText primary="Type" secondary={categories[selectedNode.category].name} /></ListItem>
            <ListItem><ListItemIcon><Memory /></ListItemIcon><ListItemText primary="CPU Usage" secondary="78%" /></ListItem>
            <ListItem><ListItemIcon><Storage /></ListItemIcon><ListItemText primary="Memory" secondary="12.3 GB / 32 GB" /></ListItem>
          </List>
          <Box className="mt-auto space-y-2">
            <Button variant="contained" size="small" fullWidth startIcon={<Insights />}>Analyze Traffic</Button>
            <Button variant="outlined" size="small" fullWidth startIcon={<Cable />}>Ping Node</Button>
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" className="flex-grow flex items-center justify-center">Select a node to view details.</Typography>
      )}
    </Paper>
  );

  return (
    <Box className="h-full flex flex-col p-4">
      <Header title="Network Topology" description="Live visualization of the Omega cybersecurity mesh." />
      <Box className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Graph */}
        <Paper className="card md:col-span-2 h-[calc(100vh-200px)]">
          <ReactECharts
            option={graphOptions}
            style={{ height: '100%', width: '100%' }}
            theme="dark"
            onEvents={{ 'click': onChartClick }}
          />
        </Paper>

        {/* Details Panel */}
        <Box className="md:col-span-1 h-full">
          <SelectedNodeDetails />
        </Box>
      </Box>
    </Box>
  );
};

export default NetworkTopologyDashboard;
