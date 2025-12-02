import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, Stepper, Step, StepLabel, Slider,
  Select, MenuItem, FormControl, InputLabel, Card, CardContent, Chip
} from '@mui/material';
import { PlayCircle, PauseCircle, StopCircle, Assessment, ModelTraining } from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';

import { useAppSelector, useAppDispatch } from '@/hooks/useRedux';
import { simulationActions } from '@/state/simulation/simulation.slice';
import { Header } from '../layout/Header';

// --- FAKE DATA & MOCKS ---
const fakeScenarios = [
  { id: 'scn_01', name: 'DDoS on Core Services' },
  { id: 'scn_02', name: 'Ransomware Propagation (Epsilon Variant)' },
  { id: 'scn_03', name: 'Insider Threat: Data Exfiltration' },
];

const fakeTimelineOptions = {
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'time', axisLine: {lineStyle: { color: '#888' }} },
  yAxis: { type: 'value', name: 'Impact', axisLine: {lineStyle: { color: '#888' }} },
  series: [{
    name: 'Events',
    type: 'scatter',
    symbolSize: 15,
    data: [
      [new Date(Date.now() + 10000).toISOString(), 2, 'Initial Breach'],
      [new Date(Date.now() + 30000).toISOString(), 5, 'Lateral Movement Detected'],
      [new Date(Date.now() + 45000).toISOString(), 3, 'Sentinel Agent Deployed'],
      [new Date(Date.now() + 60000).toISOString(), 8, 'Data Encryption Started'],
      [new Date(Date.now() + 75000).toISOString(), 6, 'Honeypot Activated'],
    ],
    encode: { tooltip: 2 }
  }],
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
};

// --- Main Component ---
const SimulationDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { status, activeScenario, parameters, results } = useAppSelector((state) => state.simulation);
  const [localParams, setLocalParams] = useState(parameters);

  const handleStart = () => {
    dispatch(simulationActions.startSimulation({ scenarioId: activeScenario, parameters: localParams }));
  };

  const isRunning = status === 'RUNNING';

  return (
    <Box className="h-full flex flex-col p-4 space-y-4">
      <Header title="Cybernetic Simulation Engine" description="Orchestrate and analyze digital twin simulations to test platform resilience." />

      <Box className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* === Configuration & Control Panel === */}
        <Paper className="card lg:col-span-3 h-full flex flex-col">
          <Typography variant="h6" gutterBottom>Configuration</Typography>
          <FormControl fullWidth margin="normal" disabled={isRunning}>
            <InputLabel>Attack Scenario</InputLabel>
            <Select value={activeScenario || fakeScenarios[0].id} label="Attack Scenario">
              {fakeScenarios.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Box marginY={2}>
            <Typography gutterBottom>AI Defense Posture</Typography>
            <Slider defaultValue={80} aria-label="AI Aggressiveness" valueLabelDisplay="auto" disabled={isRunning} />
          </Box>
          <Box className="flex-grow" />
          <Box className="space-y-2 mt-4">
            <Button variant="contained" startIcon={<PlayCircle />} fullWidth onClick={handleStart} disabled={isRunning}>
              Start Simulation
            </Button>
            <Button variant="outlined" color="warning" startIcon={<PauseCircle />} fullWidth disabled={!isRunning}>
              Pause
            </Button>
            <Button variant="outlined" color="error" startIcon={<StopCircle />} fullWidth disabled={!isRunning}>
              Stop & Analyze
            </Button>
          </Box>
        </Paper>

        {/* === Live Monitoring & Analysis === */}
        <Paper className="card lg:col-span-9 h-full">
          {status === 'IDLE' && (
            <Box className="flex items-center justify-center h-full text-center">
              <Typography variant="h6" color="text.secondary">Ready to start simulation.</Typography>
            </Box>
          )}
          {isRunning && (
             <Box>
                <Typography variant="h6" gutterBottom>Live Simulation Timeline</Typography>
                <ReactECharts option={fakeTimelineOptions} style={{ height: '300px' }} theme="dark" />
                <Grid container spacing={2} className="mt-4">
                  {['MTTD', 'MTTR', 'System Integrity', 'Assets Compromised'].map(kpi => (
                    <Grid item xs={6} md={3} key={kpi}>
                       <Card><CardContent><Typography variant="button">{kpi}</Typography><Typography variant="h4">--</Typography></CardContent></Card>
                    </Grid>
                  ))}
                </Grid>
            </Box>
          )}
          {status === 'COMPLETE' && (
            <Box>
              <Typography variant="h6" gutterBottom>Analysis & Recommendations</Typography>
              <Chip icon={<Assessment />} label="Simulation Complete" color="success" className="mb-4" />
              <Typography variant="body1">The AI core recommends increasing sentinel agent density in subnet-gamma based on observed attack paths.</Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default SimulationDashboard;
