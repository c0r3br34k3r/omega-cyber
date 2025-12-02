import React, { useMemo } from 'react';
import { Box, Paper, Typography, Grid, Chip, LinearProgress } from '@mui/material';
import ReactECharts from 'echarts-for-react';

import { useAppSelector } from '@/hooks/useRedux';
import { Header } from '../layout/Header';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

// --- Helper Components (Widgets) ---
// Using React.memo is crucial for performance in a high-frequency dashboard.
// Only the widgets whose props have changed will re-render.

const StatGauge = React.memo(({ name, value, max, unit }: { name: string, value: number, max: number, unit: string }) => (
  <Paper className="card h-full flex flex-col justify-between">
    <Typography variant="subtitle2" color="text.secondary">{name}</Typography>
    <ReactECharts
      option={{
        series: [{
          type: 'gauge',
          progress: { show: true, width: 12 },
          axisLine: { lineStyle: { width: 12 } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: { valueAnimation: true, fontSize: 24, offsetCenter: [0, '70%'], formatter: '{value}' + unit },
          data: [{ value }],
          max,
        }],
      }}
      style={{ height: '150px' }}
      theme="dark"
    />
  </Paper>
));

const TimeSeriesChart = React.memo(({ title, data }: { title: string, data: any }) => (
    <Paper className="card h-full">
        <Typography variant="subtitle2" color="text.secondary" className="mb-2">{title}</Typography>
        <ReactECharts option={data} style={{ height: '250px' }} theme="dark" />
    </Paper>
));

const fakeCpuHistory = {
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => `T-${10 - i}`), show: false },
  yAxis: { type: 'value', max: 100, show: false },
  series: [{
    data: [65, 68, 72, 70, 75, 80, 78, 82, 85, 88],
    type: 'line',
    smooth: true,
    areaStyle: {},
  }],
  grid: { top: 10, bottom: 10, left: 10, right: 10 },
};

// --- Main Component ---
const SystemMonitoringDashboard: React.FC = () => {
  const systemState = useAppSelector((state) => state.system); // Assuming a system slice exists

  return (
    <Box className="h-full flex flex-col p-4 space-y-4">
      <Header title="Global System Overview" description="Real-time health and performance metrics for the entire Omega platform." />

      {/* Top Row: Key Gauges */}
      <Grid container spacing={4}>
        <Grid item xs={6} sm={3}><StatGauge name="Platform CPU Load" value={88} max={100} unit="%" /></Grid>
        <Grid item xs={6} sm={3}><StatGauge name="Platform Memory" value={76} max={100} unit="%" /></Grid>
        <Grid item xs={6} sm={3}><StatGauge name="Mesh Throughput" value={8.9} max={10} unit=" Gbps" /></Grid>
        <Grid item xs={6} sm={3}><StatGauge name="Active Sentinels" value={147} max={150} unit="" /></Grid>
      </Grid>
      
      {/* Second Row: Time-series and Sub-system status */}
      <Grid container spacing={4} className="flex-grow">
        <Grid item xs={12} md={8}>
          <TimeSeriesChart title="Platform CPU History (Last 10 Min)" data={fakeCpuHistory} />
        </Grid>
        <Grid item xs={12} md={4}>
           <Paper className="card h-full">
             <Typography variant="subtitle2" color="text.secondary" className="mb-2">Module Status</Typography>
             <Box className="space-y-4">
               {['Intelligence Core', 'Mesh Network', 'Trust Fabric', 'Digital Twin'].map(module => (
                 <div key={module}>
                   <Box display="flex" justifyContent="space-between" alignItems="center">
                     <Typography variant="body2">{module}</Typography>
                     <Chip label="Online" color="success" size="small" />
                   </Box>
                   <LinearProgress variant="determinate" value={(Math.random() * 50) + 30} />
                 </div>
               ))}
             </Box>
           </Paper>
        </Grid>
      </Grid>

    </Box>
  );
};

export default SystemMonitoringDashboard;
