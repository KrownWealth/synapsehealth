import type { Metadata } from 'next';
import { QueryProvider } from '@/components/ui/QueryProvider';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'SepSofa — Prior Authorization Accelerator',
  description: 'Cross-patient PA worklist and Da Vinci PAS submission for clinical practitioners',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
