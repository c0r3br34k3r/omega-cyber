import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';

import { store } from './state/store';
import { ThemeProvider, useTheme } from './providers/ThemeProvider';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { FullPageLoader } from './components/system/FullPageLoader';
import { MainLayout } from './components/layout/MainLayout';
import { GlobalNotificationManager } from './components/system/GlobalNotificationManager';
import { coreActions } from './state/core/core.slice';

// =============================================================================
// LAZY-LOADED PAGE COMPONENTS
// =============================================================================
// Using React.lazy for code-splitting. Each page is a separate chunk,
// loaded on demand. This is critical for performance in a large-scale app.
// =============================================================================

const SystemMonitoringDashboard = lazy(() => import('./components/dashboards/SystemMonitoringDashboard'));
const NetworkTopologyDashboard = lazy(() => import('./components/dashboards/NetworkTopologyDashboard'));
const ThreatIntelligenceDashboard = lazy(() => import('./components/dashboards/ThreatIntelligenceDashboard'));
const SimulationDashboard = lazy(() => import('./components/dashboards/SimulationDashboard'));
const ARVREnvironmentDashboard = lazy(() => import('./components/dashboards/ARVREnvironmentDashboard'));
const SettingsPage = lazy(() => import('./components/pages/SettingsPage'));

// --- App Root Component ---
// This component initializes the global WebSocket connection and renders the router.
const AppRoot: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    // Initiate connection to the Omega backend services via gRPC-Web/WebSocket
    // This action will be handled by our Redux Saga middleware.
    store.dispatch(coreActions.startConnection());

    // Clean up the connection on component unmount
    return () => {
      store.dispatch(coreActions.stopConnection());
    };
  }, []);

  return (
    <Suspense fallback={<FullPageLoader message="Loading page..." />}>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Main dashboard routes are nested within the persistent layout */}
          <Route path="/" element={<Navigate to="/monitoring/system" replace />} />
          <Route path="/monitoring/system" element={<SystemMonitoringDashboard />} />
          <Route path="/monitoring/network" element={<NetworkTopologyDashboard />} />
          <Route path="/intelligence/threats" element={<ThreatIntelligenceDashboard />} />
          <Route path="/simulation/control" element={<SimulationDashboard />} />
          <Route path="/visualization/ar-vr" element={<ARVREnvironmentDashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          
          {/* Catch-all route for not-found pages */}
          <Route path="*" element={<div>Page Not Found</div>} />
        </Route>
      </Routes>
    </Suspense>
  );
};

// --- Main App Component ---
// This is the top-level component that wraps the entire application
// in necessary context providers.
function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider>
          <Router>
            <GlobalNotificationManager />
            <AppRoot />
          </Router>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;