import './globals.css';

export const metadata = {
  title: 'Apex Trader',
  description: 'Grid-based algorithmic crypto trading on Alpaca.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090b10',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
