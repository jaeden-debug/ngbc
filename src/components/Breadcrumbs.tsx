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
      {/* Styled by `.ng-breadcrumb` in globals.css rather than by each consuming
          route, which is why the library previously rendered a raw numbered list
          while the profile page restyled the same markup locally. */}
      <nav aria-label="Breadcrumb" className="ng-breadcrumb">
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
