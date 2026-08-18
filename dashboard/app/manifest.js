/* Apex Trader — PWA manifest.

   What makes "Add to Home Screen" produce an app rather than a bookmark:
   `standalone` drops the browser chrome, `start_url` opens on the live view
   rather than the build-status page at /, and the colors stop iOS painting a
   white bar behind the status area on a dark app.

   Next serves this at /manifest.webmanifest and links it automatically. */

export default function manifest() {
  return {
    name: 'Apex Trader',
    short_name: 'Apex',
    description: 'Grid-based algorithmic crypto trading on Alpaca.',
    start_url: '/m/live',
    scope: '/m',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#090b10',
    theme_color: '#090b10',
    icons: [
      { src: '/logo-mark.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
