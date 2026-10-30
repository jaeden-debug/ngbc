import type { LicenceNotice } from "../../lib/hunt/source-attribution";

/**
 * The statements an authority's licence requires beside its material, each
 * printed once and verbatim. Shown in full, never truncated or collapsed
 * further than the sources it belongs to: the King's Printer Licence – British
 * Columbia asks for its statement to be displayed prominently.
 */
export default function LicenceNotices({ notices, className }: { notices: readonly LicenceNotice[]; className?: string }) {
  if (!notices.length) return null;
  return (
    <div className={className} data-licence-notices="">
      {notices.map((notice) => (
        <p key={notice.text} data-licence={notice.licence ?? undefined}>{notice.text}</p>
      ))}
    </div>
  );
}
