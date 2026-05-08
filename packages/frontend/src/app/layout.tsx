import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { GenerationProvider } from '@/contexts/GenerationContext';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { FloatingThemeToggle } from '@/components/ui/FloatingThemeToggle';
import { AuthProvider } from '@/components/auth/AuthContext';
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
        {/* Inter remains the workhorse for product UI. Bricolage Grotesque
            is the display face for headings (warmer, more humanistic than
            a default grotesque). JetBrains Mono is the mono — used only
            for codes/passwords/programme codes. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <GenerationProvider>
                <AuthGate>{children}</AuthGate>
                <ToastContainer />
                <FloatingThemeToggle />
              </GenerationProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
