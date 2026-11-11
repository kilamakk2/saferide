export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 70" className={className} role="img" aria-label="Move Naija">
      <rect x="4" y="16" width="34" height="8" rx="4" className="fill-warning" />
      <rect x="10" y="31" width="28" height="8" rx="4" className="fill-primary" />
      <rect x="2" y="46" width="30" height="8" rx="4" className="fill-warning" />
      <path
        d="M30 62 42 10h15l6 27 17-27h16l-8 52H74l5-30-15 24H54l-6-24-5 30Z"
        className="fill-primary"
      />
    </svg>
  );
}
