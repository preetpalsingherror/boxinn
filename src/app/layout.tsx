import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BOX INN Member Companion | Yelahanka, Bengaluru',
  description: 'Private mobile-first web companion for enrolled members of BOX INN gym.',
  manifest: '/manifest.json',
  icons: {
    icon: '/brand/bxn-mark.png',
    apple: '/brand/bxn-mark.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BOX INN',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0B0E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-[#0A0B0E] text-[#F8F9FA]">
      <body className="min-h-screen bg-[#0A0B0E] text-[#F8F9FA] antialiased selection:bg-[#CADA03] selection:text-[#0A0B0E] pb-20 md:pb-0">
        {children}
      </body>
    </html>
  );
}
