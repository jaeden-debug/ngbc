import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "North Ground Bushcraft",
  description:
    "Bushcraft challenges, honest gear reviews, practical teaching, and exploration — tested in real northern Canadian conditions.",
  keywords: [
    "North Ground Bushcraft",
    "bushcraft Canada",
    "winter camping Canada",
    "camping adventures",
    "survival challenges",
    "gear reviews",
    "hunting Canada",
    "Jaeden Doody",
    "Laith Halwani",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}