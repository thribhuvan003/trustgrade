import { Instrument_Sans, IBM_Plex_Mono } from 'next/font/google';
import Sidebar from '../components/Sidebar';
import './globals.css';

const instrument = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-instrument',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
});

export const metadata = {
  title: 'TrustGrade',
  description: 'Deterministic grading with teacher-approved answers.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${instrument.variable} ${plexMono.variable}`}>
      <body className="flex h-screen overflow-hidden bg-bg text-text">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
