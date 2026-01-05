import type { Metadata } from 'next';
import { ThemeRegistry } from '@/components/providers/ThemeRegistry';
import { NotificationProvider } from '@/hooks/useNotification';
import './globals.css';

export const metadata: Metadata = {
  title: 'HerdWatch',
  description: 'Workforce fatigue management and shift planning',
  icons: {
    icon: [
      { url: '/favicon-32.svg', sizes: '32x32', type: 'image/svg+xml' },
      { url: '/favicon-16.svg', sizes: '16x16', type: 'image/svg+xml' },
    ],
    apple: '/app-icon-192.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
