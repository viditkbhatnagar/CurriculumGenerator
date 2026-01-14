import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { GenerationProvider } from '@/contexts/GenerationContext';
import { ThemeProvider } from '@/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Curriculum Generator App',
  description: 'AI-powered curriculum generation for AGCQ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body>
        <QueryProvider>
          <ThemeProvider>
            <GenerationProvider>{children}</GenerationProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
