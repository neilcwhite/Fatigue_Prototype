import type { Metadata } from 'next';
import { ThemeRegistry } from '@/components/providers/ThemeRegistry';
import { NotificationProvider } from '@/hooks/useNotification';
import './globals.css';

export const metadata: Metadata = {
  title: 'HerdWatch',
  description: 'Workforce fatigue management and shift planning',
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
