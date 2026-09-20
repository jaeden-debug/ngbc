import { ImageResponse } from "next/og";
import { loadHuntBrief } from "./data.ts";

export const alt = "North Ground Hunt Brief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ shareId: string }> };

export default async function HuntBriefOpenGraphImage({ params }: Props) {
  const { shareId } = await params;
  const result = await loadHuntBrief(shareId);
  const brief = result.status === "found" ? result.brief : null;
  const status = brief?.regulatory.status.replaceAll("_", " ") ?? "BRIEF UNAVAILABLE";

  return new ImageResponse(
    <div
      style={{
        background: "radial-gradient(circle at 82% 8%, #273125 0%, #10130f 36%, #060706 78%)",
        color: "#d9d2ba",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "68px 76px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", fontSize: 24, letterSpacing: 7, textTransform: "uppercase" }}>
        North Ground Hunt · Shared brief
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ color: "#f4f0e4", display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>
          {brief?.species.displayName ?? "Hunt Brief"}
        </div>
        {brief && (
          <div style={{ display: "flex", fontSize: 31, marginTop: 24 }}>
            {brief.managementZone?.displayName ?? brief.jurisdiction.displayName} · {brief.selectedDate}
          </div>
        )}
      </div>
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <div style={{ border: "2px solid #d9d2ba", display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: 4, padding: "13px 18px" }}>
          {status}
        </div>
        <div style={{ color: "#aaa58f", display: "flex", fontSize: 22 }}>
          Snapshot · Check current rules before hunting
        </div>
      </div>
    </div>,
    size,
  );
}
