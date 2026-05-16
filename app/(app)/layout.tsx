export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      {/* Sidebar is hidden on mobile; the Sidebar component renders its own overlay on small screens */}
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
