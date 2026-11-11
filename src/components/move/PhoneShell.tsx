import type { ReactNode } from "react";

function StatusBar() {
  return (
    <div className="status-bar pointer-events-none absolute inset-x-0 top-0 z-50 hidden h-12 items-center justify-between px-7 pt-1 text-[15px] font-semibold text-foreground sm:flex">
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
          <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 0 0 8 .3 10.6 10.6 0 0 0 .5 3.4l1.3 1.3A8.8 8.8 0 0 1 8 2.2Zm0 3.7c1.4 0 2.7.5 3.6 1.4L13 6a7 7 0 0 0-10 0l1.4 1.3A5.2 5.2 0 0 1 8 5.9Zm0 3.6c.5 0 1 .2 1.3.5L8 11.7 6.7 10c.3-.3.8-.5 1.3-.5Z" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" />
          <rect x="24" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/** Renders the app full-screen on phones and inside a device frame on larger screens. */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-desk sm:p-6">
      <div className="phone-frame relative h-[100dvh] w-full overflow-hidden bg-background sm:h-[844px] sm:max-h-[calc(100dvh-48px)] sm:w-[390px] sm:rounded-[44px] sm:shadow-phone">
        <StatusBar />
        {children}
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-50 hidden h-[5px] w-32 -translate-x-1/2 rounded-full bg-ink sm:block" />
      </div>
    </div>
  );
}
