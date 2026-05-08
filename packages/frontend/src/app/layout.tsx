import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { GenerationProvider } from '@/contexts/GenerationContext';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { FloatingThemeToggle } from '@/components/ui/FloatingThemeToggle';
import Auth0ProviderWrapper from '@/components/auth/Auth0ProviderWrapper';
import AuthBridge from '@/components/auth/AuthBridge';
import AuthGate from '@/components/auth/AuthGate';

export const metadata: Metadata = {
  title: 'Curriculum Generator | AGCQ',
  description: 'AI-powered curriculum generation for AGCQ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          <ThemeProvider>
            <Auth0ProviderWrapper>
              <AuthBridge />
              <GenerationProvider>
                <AuthGate>{children}</AuthGate>
                <ToastContainer />
                <FloatingThemeToggle />
              </GenerationProvider>
            </Auth0ProviderWrapper>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
