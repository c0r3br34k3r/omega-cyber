import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { SimulationEvent, subscribeToSimulationEvents } from '../data/simulationOutputs';

// Re-using the useECharts hook
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
  }, []);

  useEffect(() => {
    chartInstance.current?.setOption(option);
  }, [option]);

  return <div ref={chartRef} style={{ width: '100%', height: '300px', ...style }} />;
};

const SimulationDashboard: React.FC = () => {
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);

  useEffect(() => {
    const { start, stop } = subscribeToSimulationEvents((event) => {
      setSimulationEvents((prevEvents) => [event, ...prevEvents].slice(0, 20)); // Keep last 20 events
    }, 2000); // New event every 2 seconds

    start();
    return () => stop();
  }, []);

  // Prepare data for ECharts
  const eventTypeData = simulationEvents.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<SimulationEvent['type'], number>);

  const anomalySeverityData = simulationEvents
    .filter(event => event.type === 'anomaly' && event.details?.severity)
    .reduce((acc, event) => {
      const severity = event.details!.severity as string;
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);


  const eventTypeOption: EChartsOption = {
    title: { text: 'Simulation Event Types' },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: 'Event Type',
        type: 'pie',
        radius: '50%',
        data: Object.entries(eventTypeData).map(([name, value]) => ({ name, value })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  const anomalySeverityOption: EChartsOption = {
    title: { text: 'Anomaly Severity' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: Object.keys(anomalySeverityData).sort((a, b) => { // Order severities
        const order = { "Low": 0, "Medium": 1, "High": 2 };
        return order[a as 'Low' | 'Medium' | 'High'] - order[b as 'Low' | 'Medium' | 'High'];
      })
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Count',
        type: 'bar',
        data: Object.entries(anomalySeverityData)
          .sort(([a], [b]) => {
            const order = { "Low": 0, "Medium": 1, "High": 2 };
            return order[a as 'Low' | 'Medium' | 'High'] - order[b as 'Low' | 'Medium' | 'High'];
          })
          .map(([, value]) => value),
        itemStyle: { color: '#e04848' }
      }
    ]
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded shadow">
        {useECharts(eventTypeOption)}
      </div>
      <div className="bg-white p-4 rounded shadow">
        {useECharts(anomalySeverityOption)}
      </div>
      <div className="bg-white p-4 rounded shadow md:col-span-2">
        <h3 className="text-lg font-semibold mb-2">Recent Simulation Events</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {simulationEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{event.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.details ? JSON.stringify(event.details) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SimulationDashboard;
