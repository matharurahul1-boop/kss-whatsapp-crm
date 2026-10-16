import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";

export function AppLayout() {
  return (
    // Full viewport height, nothing overflows outside — only inner <main> scrolls
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />

        {/* scroll-area: only this div scrolls on mobile */}
        <main className="scroll-area px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
