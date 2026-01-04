import type { Metadata } from 'next';
import { ThemeRegistry } from '@/components/providers/ThemeRegistry';
import { NotificationProvider } from '@/hooks/useNotification';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fatigue Management System',
  description: 'Network Rail compliant shift planning and fatigue monitoring',
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
