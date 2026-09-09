import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      productionUrl ??
      'http://localhost:3000',
  ),
  title: 'Calorie Chat — Personal meal tracker',
  description:
    'Log meals naturally, review calorie estimates, and follow your daily progress.',
  openGraph: {
    title: 'Calorie Chat',
    description: 'Eat. Ask. Track.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calorie Chat',
    description: 'Eat. Ask. Track.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7faf7',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        data-demo-login-id={process.env.DEMO_LOGIN_ID}
        data-demo-login-password={process.env.DEMO_LOGIN_PASSWORD}
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
