export default function Logo({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="6" r="2.5" fill="url(#g)" />
      <rect x="18" y="8.5" width="4" height="18.5" rx="2" fill="url(#g)" />
      <path
        d="M12 27 L9 34 L11 36.5 L29 36.5 L31 34 L28 27 Z"
        fill="url(#g)"
        stroke="url(#g)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M17 9 Q12 9 13 3" stroke="url(#g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M15 13 Q7 11 9 1" stroke="url(#g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M23 9 Q28 9 27 3" stroke="url(#g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M25 13 Q33 11 31 1" stroke="url(#g)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
