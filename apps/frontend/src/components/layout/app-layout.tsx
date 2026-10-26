import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";

export function AppLayout() {
  return (
    // Inset floating navigation; only the content area scrolls.
    <div className="app-shell flex h-[100dvh] gap-3 overflow-hidden bg-background p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:p-5">
      <Sidebar />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4">
        <Topbar />

        {/* scroll-area: only this div scrolls on mobile */}
        <main className="scroll-area min-h-0 rounded-2xl px-1 pb-28 pt-2 sm:px-2 sm:pt-3 lg:px-3 lg:pb-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
