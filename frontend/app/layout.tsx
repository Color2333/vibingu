import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';

export const metadata: Metadata = {
  title: 'Vibing u - Digitize Your Vibe',
  description: '建立个人的生活数据集，用 AI 寻找"最佳状态"的源代码。',
  keywords: ['生活记录', 'AI分析', '健康追踪', '个人数据', '睡眠', '心情'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vibing u',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Vibing u - Digitize Your Vibe',
    description: '建立个人的生活数据集，用 AI 寻找"最佳状态"的源代码。',
    siteName: 'Vibing u',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: 'Vibing u - Digitize Your Vibe',
    description: '建立个人的生活数据集，用 AI 寻找"最佳状态"的源代码。',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ServiceWorkerRegistration />
              <main className="min-h-screen">
                {children}
              </main>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
