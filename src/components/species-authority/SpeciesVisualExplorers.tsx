"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { AuthorityShotExplorer, AuthorityVisualExplorer, AuthorityVisualRendition } from "../../lib/species-authority/types";
import styles from "./SpeciesAuthorityPage.module.css";

type Renditions = Record<string, AuthorityVisualRendition>;
type SourceNumbers = Record<string, number>;

function CitationLinks({ citations, sourceNumbers }: { citations: { sourceId: string; locator?: string }[]; sourceNumbers: SourceNumbers }) {
  return <span className={styles.citations}>{citations.map(({ sourceId, locator }) => (
    <a key={`${sourceId}-${locator ?? ""}`} href={`#${sourceId.replace("source:", "source-")}`} aria-label={`Source ${sourceNumbers[sourceId]}${locator ? `, ${locator}` : ""}`}>[{sourceNumbers[sourceId]}]</a>
  ))}</span>;
}

function ExplorerImage({ rendition, className }: { rendition: AuthorityVisualRendition; className?: string }) {
  return <figure className={`${styles.explorerFigure} ${className ?? ""}`}>
    <Image src={rendition.src} width={rendition.width} height={rendition.height} alt={rendition.alt} sizes="(min-width: 900px) 650px, calc(100vw - 48px)" loading="lazy" />
    <figcaption>{rendition.caption}</figcaption>
  </figure>;
}

export function SpeciesVisualExplorer({ explorer, renditions, sourceNumbers }: {
  explorer: AuthorityVisualExplorer;
  renditions: Renditions;
  sourceNumbers: SourceNumbers;
}) {
  const uid = useId();
  const [selectedId, setSelectedId] = useState(explorer.items[0].id);

  return <div id={explorer.id} className={styles.explorer} data-explorer={explorer.id}>
    <div className={styles.explorerHead}><span>Field visual</span><h3>{explorer.title}</h3><p>{explorer.intro}</p></div>
    <div className={styles.explorerChoices} aria-label={`${explorer.title} choices`}>
      {explorer.items.map((item) => <button key={item.id} type="button" aria-pressed={selectedId === item.id} aria-controls={`${uid}-${item.id}`} onClick={() => setSelectedId(item.id)}>{item.label}</button>)}
    </div>
    <div className={styles.explorerPanels} aria-live="polite">
      {explorer.items.map((item) => <article id={`${uid}-${item.id}`} key={item.id} hidden={selectedId !== item.id} data-explorer-panel={item.id}>
        {item.renditionId ? <ExplorerImage rendition={renditions[item.renditionId]} /> : null}
        <div className={styles.explorerCopy}><h4>{item.label}</h4><p className={styles.explorerAnswer}>{item.directAnswer} <CitationLinks citations={item.citations} sourceNumbers={sourceNumbers} /></p><ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{item.caution ? <p className={styles.explorerCaution}>{item.caution}</p> : null}</div>
      </article>)}
    </div>
  </div>;
}

export function SpeciesShotPlacementExplorer({ explorer, renditions, sourceNumbers }: {
  explorer: AuthorityShotExplorer;
  renditions: Renditions;
  sourceNumbers: SourceNumbers;
}) {
  const uid = useId();
  const [selection, setSelection] = useState({ itemId: explorer.items[0].id, view: "external" as "external" | "anatomy" });
  const selected = explorer.items.find((item) => item.id === selection.itemId) ?? explorer.items[0];
  const canShowAnatomy = Boolean(selected.anatomyRenditionId);

  function selectAngle(itemId: string) {
    setSelection({ itemId, view: "external" });
  }

  return <div id={explorer.id} className={`${styles.explorer} ${styles.shotExplorer}`} data-explorer={explorer.id}>
    <div className={styles.explorerHead}><span>Decision aid · not a legal answer</span><h3>{explorer.title}</h3><p>{explorer.intro}</p></div>
    <div className={styles.explorerChoices} aria-label="Shot angle">
      {explorer.items.map((item) => <button key={item.id} type="button" aria-pressed={selection.itemId === item.id} aria-controls={`${uid}-${item.id}`} onClick={() => selectAngle(item.id)}><span data-assessment={item.assessment}>{item.assessment}</span>{item.label}</button>)}
    </div>
    {canShowAnatomy ? <div className={styles.viewToggle} aria-label="Visual layer">
      <button type="button" aria-pressed={selection.view === "external"} onClick={() => setSelection({ itemId: selected.id, view: "external" })}>External</button>
      <button type="button" aria-pressed={selection.view === "anatomy"} onClick={() => setSelection({ itemId: selected.id, view: "anatomy" })}>Anatomy</button>
    </div> : null}
    <div className={styles.explorerPanels} aria-live="polite">
      {explorer.items.map((item) => {
        const visible = selection.itemId === item.id;
        const renditionId = visible && selection.view === "anatomy" && item.anatomyRenditionId ? item.anatomyRenditionId : item.renditionId;
        return <article id={`${uid}-${item.id}`} key={item.id} hidden={!visible} data-explorer-panel={item.id} data-assessment={item.assessment}>
          {/*
            THE VERDICT COMES FROM THE ASSESSMENT, NEVER FROM WHETHER AN IMAGE
            EXISTS. This was `renditionId ? <image> : <PASS / No shot>` — so a
            missing illustration was rendered as a shot-placement decision,
            labelled "pass, do not shoot" to a screen reader.

            It looked correct only by coincidence: on the white-tail page every
            PASS angle happens to have no illustration and every shootable angle
            has one, so image-presence and the verdict agreed. They are not the
            same fact. Any species with a PREFERRED angle and no artwork would
            have told a hunter not to take a shot the guidance recommends, which
            is the dangerous direction of §62's first priority.

            A missing image for a shootable angle now renders the text-first
            state — the guidance is already complete in words below — rather
            than an empty frame or a verdict nobody wrote.
          */}
          {item.assessment === "PASS"
            ? <div className={styles.passVisual} role="img" aria-label={`${item.label}: pass, do not shoot`}><strong>PASS</strong><span>No shot</span></div>
            : renditionId && renditions[renditionId]
              ? <ExplorerImage rendition={renditions[renditionId]} className={styles.shotFigure} />
              : null}
          <div className={styles.explorerCopy}><div className={styles.assessment} data-assessment={item.assessment}>{item.assessment}</div><h4>{item.label}</h4><p className={styles.explorerAnswer}>{item.directAnswer} <CitationLinks citations={item.citations} sourceNumbers={sourceNumbers} /></p><p className={styles.targetRegion}><strong>Target region:</strong> {item.targetRegion}</p><ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{item.caution ? <p className={styles.explorerCaution}>{item.caution}</p> : null}</div>
        </article>;
      })}
    </div>
    <p className={styles.legalHandoff}>{explorer.legalHandoff}</p>
  </div>;
}
