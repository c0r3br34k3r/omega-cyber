import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import the single, consolidated global stylesheet.
// This contains all Tailwind directives, custom properties, and base styles.
import './App.css';

/**
 * =============================================================================
 * OMEGA PLATFORM - APPLICATION BOOTSTRAPPER
 * =============================================================================
 *
 * This is the main entry point for the Omega Command Dashboard. Its primary
 * responsibilities are:
 *
 * 1. Conditionally initializing a mock API server for isolated development.
 * 2. Rendering the root React component (`<App />`) into the DOM.
 *
 */

/**
 * Dynamically prepares and starts the mock service worker (MSW) in development.
 * This function is tree-shaken and will not be included in production builds,
 * ensuring zero performance overhead.
 */
async function enableMocking() {
  if (import.meta.env.MODE !== 'development') {
    return;
  }

  // The `worker` is created by the `msw init` command.
  const { worker } = await import('./mocks/browser');
  
  // Start the worker. `onUnhandledRequest` logs requests that are not mocked,
  // which is useful for debugging during development.
  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

/**
 * Renders the application to the DOM.
 */
function renderApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Fatal Error: The root element with ID 'root' was not found in the DOM. Please check your index.html file.");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// --- Application Start ---
// We first enable mocking (if in development) and then render the app.
// This ensures that the mock server is ready to intercept API calls
// from the very beginning of the application lifecycle.
enableMocking().then(() => {
  renderApp();
});