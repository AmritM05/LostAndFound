import Link from "next/link";
export default function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Magpie home">
      <svg
        width="29"
        height="29"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 25 12 9l7 10 8-14v21"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="26.5" cy="5.5" r="3.5" fill="#3973C6" />
      </svg>
      <span>Magpie</span>
    </Link>
  );
}
