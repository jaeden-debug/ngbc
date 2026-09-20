import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/site";

export const alt = `${SITE_NAME} — northern fieldwork and practical skills`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 72% 18%, rgba(201,194,166,.18), transparent 32%), linear-gradient(145deg, #10130f, #050706 62%)",
        color: "#c9c2a6",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "80px 90px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <div style={{ fontSize: 28, letterSpacing: 10, textTransform: "uppercase" }}>
          Field notes from the north
        </div>
        <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -4, marginTop: 54 }}>
          {SITE_NAME}
        </div>
        <div
          style={{
            borderTop: "2px solid rgba(201,194,166,.45)",
            fontSize: 34,
            lineHeight: 1.35,
            marginTop: 36,
            maxWidth: 920,
            paddingTop: 30,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    </div>,
    size,
  );
}
