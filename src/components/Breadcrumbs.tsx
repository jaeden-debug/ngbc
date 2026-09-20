import Link from "next/link";
import {
  breadcrumbJsonLd,
  type BreadcrumbItem,
} from "../lib/seo/structured-data";
import StructuredData from "./StructuredData";

export default function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  const data = breadcrumbJsonLd(items);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol>
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1;
            return (
              <li key={item.path}>
                {isCurrent ? (
                  <span aria-current="page">{item.name}</span>
                ) : (
                  <Link href={item.path}>{item.name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <StructuredData data={data} />
    </>
  );
}
