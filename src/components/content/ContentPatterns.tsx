import Link from "next/link";
import type { BlockResult, KeyFact, SourceRecord } from "../../lib/content-contract/types";
import type { ResourceSummary } from "../../lib/content/repository";

export function DirectAnswer({ children }: { children: React.ReactNode }) {
  return <p className="content-direct-answer">{children}</p>;
}

export function KeyFacts({ facts }: { facts: KeyFact[] }) {
  return (
    <dl className="content-key-facts">
      {facts.map((fact) => (
        <div key={fact.id}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AppBlockList({ result }: { result: BlockResult }) {
  if (!result.blocks.length) return null;
  return (
    <div className="content-block-list">
      {result.blocks.map(({ block }) => (
        <aside key={block.id} className={`content-block content-block--${block.type}`}>
          <h3>{block.type.replaceAll("_", " ")}</h3>
          <p>{block.content.plainText}</p>
        </aside>
      ))}
    </div>
  );
}

export function SourceList({ sources }: { sources: SourceRecord[] }) {
  return (
    <ol className="content-sources">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} rel="noreferrer" target="_blank">{source.title}</a>
          <span>{source.publisher} · retrieved {source.retrievedAt.slice(0, 10)}</span>
        </li>
      ))}
    </ol>
  );
}

export function RelatedResources({ resources }: { resources: ResourceSummary[] }) {
  if (!resources.length) return null;
  return (
    <ul className="content-related">
      {resources.map((resource) => resource.canonicalUrl && (
        <li key={resource.id}>
          <Link href={resource.canonicalUrl}>{resource.title}</Link>
          <p>{resource.description}</p>
        </li>
      ))}
    </ul>
  );
}
