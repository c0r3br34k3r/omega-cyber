import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { ThreatAlert, subscribeToThreatAlerts } from '../data/threatIntelligence';

// Re-using the useECharts hook from SystemMonitoringDashboard
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


const ThreatIntelligenceDashboard: React.FC = () => {
  const [recentAlerts, setRecentAlerts] = useState<ThreatAlert[]>([]);

  useEffect(() => {
    const { start, stop } = subscribeToThreatAlerts((alert) => {
      setRecentAlerts((prevAlerts) => [alert, ...prevAlerts].slice(0, 10)); // Keep last 10 alerts
    }, 3000); // New alert every 3 seconds

    start();
    return () => stop();
  }, []);

  // Prepare data for ECharts
  const alertTypeData = recentAlerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<ThreatAlert['type'], number>);

  const severityData = recentAlerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {} as Record<ThreatAlert['severity'], number>);

  const alertTypeOption: EChartsOption = {
    title: { text: 'Alerts by Type' },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: 'Alert Type',
        type: 'pie',
        radius: '50%',
        data: Object.entries(alertTypeData).map(([name, value]) => ({ name, value })),
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

  const severityOption: EChartsOption = {
    title: { text: 'Alerts by Severity' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: Object.keys(severityData).sort((a, b) => { // Order severities for better visualization
        const order = { "Low": 0, "Medium": 1, "High": 2, "Critical": 3 };
        return order[a as ThreatAlert['severity']] - order[b as ThreatAlert['severity']];
      })
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Count',
        type: 'bar',
        data: Object.entries(severityData)
          .sort(([a], [b]) => {
            const order = { "Low": 0, "Medium": 1, "High": 2, "Critical": 3 };
            return order[a as ThreatAlert['severity']] - order[b as ThreatAlert['severity']];
          })
          .map(([, value]) => value),
        itemStyle: { color: '#e04848' }
      }
    ]
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-4 rounded shadow">
        {useECharts(alertTypeOption)}
      </div>
      <div className="bg-white p-4 rounded shadow">
        {useECharts(severityOption)}
      </div>
      <div className="bg-white p-4 rounded shadow md:col-span-2">
        <h3 className="text-lg font-semibold mb-2">Recent Alerts</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{alert.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.severity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.target}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(alert.timestamp).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{alert.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ThreatIntelligenceDashboard;
