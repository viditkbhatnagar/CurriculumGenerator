/**
 * Marks a module on a fast-moving subject (AI, data, regulation, cyber, cloud and so on).
 * Step 5 asks for a textbook from the last five years for these, and never accepts an older
 * "latest edition". Logan Pacey asked on 17 November 2026 to see which modules carry that
 * rule, since the flag was worked out in several places and shown in none.
 */
export default function FastMovingBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ${className}`}
      title="This module's subject changes quickly, so Step 5 needs a textbook from the last five years for it."
    >
      Fast-moving topic — recent textbook required
    </span>
  );
}
