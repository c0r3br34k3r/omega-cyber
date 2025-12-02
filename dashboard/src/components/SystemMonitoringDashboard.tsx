import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { subscribeToSystemMetrics } from '../data/systemMetrics';



// Custom hook to manage ECharts instance
const useECharts = (option: EChartsOption, style?: React.CSSProperties) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current);
      chartInstance.current.setOption(option);
    }

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, []); // Initialize only once

  useEffect(() => {
    chartInstance.current?.setOption(option);
  }, [option]); // Update when option changes

  return <div ref={chartRef} style={{ width: '100%', height: '300px', ...style }} />;
};

const SystemMonitoringDashboard: React.FC = () => {
  const [cpuData, setCpuData] = useState<number[]>([]);
  const [memoryData, setMemoryData] = useState<number[]>([]);
  const [networkInData, setNetworkInData] = useState<number[]>([]);
  const [networkOutData, setNetworkOutData] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);

  useEffect(() => {
    const dataLimit = 20; // Show last 20 data points

    const { start, stop } = subscribeToSystemMetrics((metrics) => {
      const newTimestamp = new Date(metrics[0].timestamp).toLocaleTimeString();
      setTimestamps((prev) => [...prev.slice(-dataLimit), newTimestamp]);
      setCpuData((prev) => [...prev.slice(-dataLimit), metrics.find((m) => m.name === 'CPU Usage')?.value || 0]);
      setMemoryData((prev) => [...prev.slice(-dataLimit), metrics.find((m) => m.name === 'Memory Usage')?.value || 0]);
      setNetworkInData((prev) => [...prev.slice(-dataLimit), metrics.find((m) => m.name === 'Network In')?.value || 0]);
      setNetworkOutData((prev) => [...prev.slice(-dataLimit), metrics.find((m) => m.name === 'Network Out')?.value || 0]);
    }, 2000); // Update every 2 seconds

    start();
    return () => stop();
  }, []);

  const commonChartOptions: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      axisLabel: {
        rotate: 45,
        interval: Math.max(0, timestamps.length - 5) // Show fewer labels for crowded charts
      }
    },
    yAxis: {
      type: 'value'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%', // Adjust for rotated labels
      containLabel: true
    }
  };

  const cpuChartOption: EChartsOption = {
    ...commonChartOptions,
    title: { text: 'CPU Usage' },
    series: [
      {
        name: 'CPU Usage',
        type: 'line',
        smooth: true,
        data: cpuData,
        areaStyle: {},
        itemStyle: { color: '#8d48e0' },
        lineStyle: { width: 3 },
      }
    ]
  };

  const memoryChartOption: EChartsOption = {
    ...commonChartOptions,
    title: { text: 'Memory Usage' },
    series: [
      {
        name: 'Memory Usage',
        type: 'line',
        smooth: true,
        data: memoryData,
        areaStyle: {},
        itemStyle: { color: '#488de0' },
        lineStyle: { width: 3 },
      }
    ]
  };

  const networkInChartOption: EChartsOption = {
    ...commonChartOptions,
    title: { text: 'Network In (Mbps)' },
    series: [
      {
        name: 'Network In',
        type: 'line',
        smooth: true,
        data: networkInData,
        areaStyle: {},
        itemStyle: { color: '#48e08d' },
        lineStyle: { width: 3 },
      }
    ]
  };

  const networkOutChartOption: EChartsOption = {
    ...commonChartOptions,
    title: { text: 'Network Out (Mbps)' },
    series: [
      {
        name: 'Network Out',
        type: 'line',
        smooth: true,
        data: networkOutData,
        areaStyle: {},
        itemStyle: { color: '#e08d48' },
        lineStyle: { width: 3 },
      }
    ]
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded shadow">
        {useECharts(cpuChartOption)}
      </div>
      <div className="bg-white p-4 rounded shadow">
        {useECharts(memoryChartOption)}
      </div>
      <div className="bg-white p-4 rounded shadow">
        {useECharts(networkInChartOption)}
      </div>
      <div className="bg-white p-4 rounded shadow">
        {useECharts(networkOutChartOption)}
      </div>
    </div>
  );
};

export default SystemMonitoringDashboard;
