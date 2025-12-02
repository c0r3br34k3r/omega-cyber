/**
 * =============================================================================
 * OMEGA PLATFORM - DASHBOARD POSTCSS CONFIGURATION
 * =============================================================================
 *
 * This configuration file defines the PostCSS processing pipeline for the Omega
 * Command Dashboard's styling. It orchestrates a series of plugins to transform
 * modern, developer-friendly CSS into optimized, browser-compatible output.
 *
 * The pipeline is environment-aware, applying more aggressive optimizations
 * for production builds.
 *
 * --- PLUGIN CHAIN ---
 * 1. `postcss-import`: Inlines @import rules, enabling a modular CSS structure.
 * 2. `tailwindcss/nesting` (with `postcss-nesting`): Enables W3C-standard CSS nesting,
 *    improving stylesheet organization and readability.
 * 3. `tailwindcss`: Processes Tailwind's utility classes and functions.
 * 4. `postcss-preset-env`: Polyfills modern CSS features for broader browser
 *    compatibility. It includes `autoprefixer` by default.
 * 5. `cssnano` (Production Only): Advanced CSS minifier that performs numerous
 *    optimizations beyond basic whitespace removal to reduce bundle size.
 *
 */
module.exports = (ctx) => ({
  plugins: {
    // --- Stage 1: Pre-processing and Structure ---

    // Handles @import statements, allowing for a modular and organized CSS codebase.
    // Must run before other plugins like tailwindcss.
    'postcss-import': {},

    // --- Stage 2: Language Extensions & Frameworks ---

    // Implements the CSS Nesting specification. Required for using nested syntax
    // within custom CSS, which works seamlessly with Tailwind's @apply directive.
    'tailwindcss/nesting': 'postcss-nesting',

    // The core engine for Tailwind CSS. It scans HTML, JS, and TSX files for
    // utility classes and generates the corresponding CSS.
    tailwindcss: {},

    // --- Stage 3: Polyfilling and Vendor Prefixing ---

    // Converts modern CSS into something most browsers can understand, based on
    // the project's `browserslist` definition. It automatically includes
    // `autoprefixer`, so it doesn't need to be listed separately.
    'postcss-preset-env': {
      stage: 3, // Use features that are reasonably stable.
      features: {
        'nesting-rules': false, // We use tailwindcss/nesting instead.
      },
    },

    // --- Stage 4: Production Optimization ---

    // Apply cssnano only in production environments for maximum optimization.
    // The `ctx.env === 'production'` check is handled by Vite.
    ...(ctx.env === 'production'
      ? {
          cssnano: {
            preset: [
              'default',
              {
                discardComments: { removeAll: true },
                // Further fine-tuning can be done here if needed.
              },
            ],
          },
        }
      : {}),
  },
});