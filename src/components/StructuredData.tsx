import type { JsonLd } from "../lib/seo/structured-data";

export default function StructuredData({ data }: { data: JsonLd }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
