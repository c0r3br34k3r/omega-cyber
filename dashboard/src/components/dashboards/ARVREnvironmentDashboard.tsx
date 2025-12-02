import React from 'react';
import { Box, Paper, Typography, Button, Switch, FormControlLabel, Grid, Chip } from '@mui/material';
import { PlayArrow, Stop, Send, Visibility } from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import ReactECharts from 'echarts-for-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { arvrActions } from '@/state/arvr/arvr.slice';
import { Header } from '../layout/Header';

// --- FAKE DATA (to be replaced by Redux state) ---
const fakeConnectedUsers = [
  { id: 'ops-01', location: 'Site A', sessionTime: '00:45:12', status: 'Live' },
  { id: 'analyst-03', location: 'Remote', sessionTime: '01:12:33', status: 'Live' },
  { id: 'field-agent-07', location: 'Site B', sessionTime: '00:15:02', status: 'Idle' },
];

const fakePerformanceOptions = {
  tooltip: { trigger: 'axis' },
  legend: { data: ['FPS', 'Latency (ms)'], textStyle: { color: '#ccc' } },
  xAxis: { type: 'category', data: ['-5m', '-4m', '-3m', '-2m', '-1m', 'Live'], axisLine: {lineStyle: { color: '#888' }}},
  yAxis: [{ name: 'FPS', type: 'value', axisLine: {lineStyle: { color: '#888' }} }, { name: 'Latency', type: 'value', axisLine: {lineStyle: { color: '#888' }} }],
  series: [
    { name: 'FPS', type: 'line', smooth: true, data: [58, 59, 60, 59, 60, 59], yAxisIndex: 0 },
    { name: 'Latency (ms)', type: 'line', smooth: true, data: [25, 26, 24, 25, 27, 26], yAxisIndex: 1 },
  ],
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
};

// --- Main Component ---
const ARVREnvironmentDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const arvrState = useAppSelector((state) => state.arvr);

  const handleStartSession = () => {
    dispatch(arvrActions.requestStartSession({ mode: 'VR' }));
  };

  const handleBroadcastAlert = () => {
    dispatch(arvrActions.broadcastAlert({ message: 'High-priority threat detected!', level: 'critical' }));
  };

  return (
    <Box className="h-full flex flex-col p-4 space-y-4">
      <Header title="AR/VR Environment Control" description="Monitor and manage all active immersive visualization sessions." />

      <Grid container spacing={4}>
        {/* === Control Panel === */}
        <Grid item xs={12} md={4}>
          <Paper className="card h-full flex flex-col">
            <Typography variant="h6" className="!mb-4">Session Control</Typography>
            <Box className="space-y-4">
              <Button variant="contained" color="primary" startIcon={<PlayArrow />} onClick={handleStartSession} fullWidth>
                Initiate New VR Session
              </Button>
              <Button variant="contained" color="warning" startIcon={<Send />} onClick={handleBroadcastAlert} fullWidth>
                Broadcast Global Alert
              </Button>
              <Button variant="outlined" color="error" startIcon={<Stop />} fullWidth>
                Terminate All Sessions
              </Button>
            </Box>
            <Box className="mt-auto pt-4">
              <FormControlLabel control={<Switch checked={arvrState.isRealtimeThreatsEnabled} />} label="Real-time Threat Feeds" />
              <FormControlLabel control={<Switch />} label="High Fidelity Graphics" />
            </Box>
          </Paper>
        </Grid>

        {/* === Performance Metrics === */}
        <Grid item xs={12} md={8}>
          <Paper className="card h-full">
            <Typography variant="h6" className="!mb-4">System Performance</Typography>
            <ReactECharts option={fakePerformanceOptions} style={{ height: '250px' }} theme="dark" />
          </Paper>
        </Grid>

        {/* === Connected Users === */}
        <Grid item xs={12}>
          <Paper className="card h-full">
            <Typography variant="h6" className="!mb-4">Connected Operators</Typography>
            <div className="ag-theme-alpine-dark" style={{ height: '300px', width: '100%' }}>
              <AgGridReact
                rowData={fakeConnectedUsers}
                columnDefs={[
                  { field: 'id', headerName: 'Operator ID', flex: 1 },
                  { field: 'location', flex: 1 },
                  { field: 'sessionTime', headerName: 'Session Duration', flex: 1 },
                  {
                    field: 'status',
                    cellRenderer: (params: any) => (
                      <Chip label={params.value} color={params.value === 'Live' ? 'success' : 'default'} size="small" />
                    ),
                  },
                ]}
                suppressCellFocus={true}
              />
            </div>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ARVREnvironmentDashboard;
