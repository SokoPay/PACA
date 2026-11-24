/** The PACA "P" mark as an SVG element for generated PNG icons (apple-touch, manifest). Same artwork as app/icon.svg. */
export function BrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a2a66" />
          <stop offset="0.55" stopColor="#0060cc" />
          <stop offset="1" stopColor="#2b9bff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#g)" />
      <path d="M20 50V14h14.5c7.6 0 12.5 4.6 12.5 11.4S42.1 37 34.5 37H27.6v13H20zm7.6-19.6h6.2c3.4 0 5.5-1.9 5.5-5s-2.1-5-5.5-5h-6.2v10z" fill="#fff" />
      <circle cx="47" cy="47" r="5" fill="#f2b134" />
    </svg>
  );
}
