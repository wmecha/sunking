import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sun King | Location Intelligence',
  description: 'Internal Google Business Profile management and reconciliation tool for Sun King operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F9FAFB] text-[#374151]">{children}</body>
    </html>
  );
}
