# Book Intelligence — Integration Plan

_How the "Book Intelligence Decomposition System" plugs into the AGCQ Curriculum Generator as a second step, run after the workflow sources the textbooks._

---

## 1. Why

Today the workflow **names** its sources but never **reads** them:

- **Step 5 (Topic-Level Sources)** identifies academic texts per topic/MLO — `title`, `authors`, `year`, `publisher`, `apaCitation`, `sourceType` (`peer_reviewed | academic_text | professional_body | open_access`), `classification` (`academic | applied`), `mloIds`.
- **Step 6 (Reading Lists)** turns those into core/supplementary readings.
- Everything downstream (Step 7 assessments, 8 case studies, 9 glossary, 10 lesson plans, 13 exam) then generates from the **model's parametric memory** plus a **flat RAG chunk store** — with no line back to _what a specific sourced book actually says_.

**Book Intelligence** inserts a decomposition step that turns each _sourced, rights-cleared textbook_ into a **structured, source-grounded knowledge layer** (typed nodes + provenance + relationships). Every later step then retrieves cited knowledge instead of inventing it. The payoff: **grounding + provenance** — generated MLOs, readings, assessments, glossary terms and exam items can each point to `Book → Chapter → Section → Page`.

## 2. Where it fits

```
Step 4  Modules & MLOs
Step 5  Topic-Level Sources   ── sources + (optionally) uploads the textbook files
          │
          ▼
  ┌──────────────────────────────────────────────┐
  │  NEW STEP 5.5: Book Ingestion                 │
  │  SME opt-in per book (rights-cleared)         │
  │  decompose → typed knowledge nodes + edges    │
  │  → embed nodes into the RAG knowledge base    │
  └──────────────────────────────────────────────┘
          │
          ▼
Step 6  Reading Lists      ┐
Step 7  Assessments        │  all retrieve from the enriched,
Step 8  Case Studies       │  cited knowledge layer instead of
Step 9  Glossary           │  parametric memory
Step 10 Lesson Plans       │
Step 13 Summative Exam     ┘
```

It is a **distinct background stage ("Step 5.5")** that runs **after Step 5 is approved** and **before Step 6 consumes the sources** — with its own status/queue, so it never blocks Step 5 approval. It is not a standalone "attach a book" tool and it does not run automatically: the **SME opts a book in per title** on the Step 5.5 screen, and only rights-cleared `academic_text` sources with an uploaded file are eligible. Decomposition is scoped to the modules/MLOs the book was sourced for, at `Standard` depth by default.

## 3. What it operates on (scoping)

Not every Step 5 source is ingestable. The step only processes sources that are **all** of:

1. **A full text worth decomposing** — `sourceType === 'academic_text'` (textbooks), not a single journal article or a URL to a paywalled abstract.
2. **Available as a file** — the org uploaded the book (Step 5 already supports per-source file uploads to S3 — see `sourceFileStore` / the S3 integration), or it is an open-access full text we can fetch.
3. **Rights-cleared** — `RIGHTS_MODE` (below) permits internal decomposition. Peer-reviewed articles and rights-restricted texts are skipped (cited only, never decomposed).

Everything else stays a citation in Step 5/6, exactly as today. A per-book **`DEPTH`** (Essential → Forensic) and the book's mapped `mloIds` bound how much is extracted — we decompose **in service of the curriculum**, not exhaustively.

## 4. Architecture

Reuse the existing RAG stack; add a structured decomposition layer on top.

```
book file (PDF/EPUB in S3)
   │  Phase A — page-aware parse
   ▼
Source Map:  Book → Part → Chapter → Section → Page   (structural, cheap, no LLM guessing)
   │  Phase B — chunked, checkpointed LLM decomposition (one chapter/section at a time)
   ▼
Node registry (new Mongo collection `bookintelligence`):
   book_record • nodes[] (concept/claim/framework/example/…) • edges[]
   │  Phase C — embed each node's paraphrased content
   ▼
Existing vector KB (vectorSearchService / embeddingService / knowledgeBaseService.ingestDocument)
   each chunk carries metadata: { bookId, nodeId, nodeType, sourceLocation,
                                   confidence, derivationType, mloIds, credibilityScore }
   │  Phase D — retrieval
   ▼
Steps 6–13 query vectorSearchService, get typed + cited knowledge, and record the
source locator on each generated artifact.
```

**Key reuses (do not rebuild):**

| Need                                | Existing piece                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Store/serve the book file           | `sourceFileStore` + S3 (already used for Step 5 uploads & exports)                                                                                                             |
| Chunk + embed + store               | `embeddingService.chunkDocument` / `generateEmbeddings`, `knowledgeBaseService.ingestDocument`, `vectorSearchService.storeEmbedding`                                           |
| Retrieve (filtered semantic search) | `vectorSearchService.search` (Atlas Vector Search, credibility/recency filters)                                                                                                |
| Long-running, resumable generation  | The Step 13 pattern shipped this session — **per-phase checkpoint to a draft + resume** (`step13Draft`); a book is far bigger than an exam, so this is mandatory, not optional |
| Background processing               | Generic `stepQueue` (with the `maxStalledCount` + stuck-progress-reset fixes)                                                                                                  |

## 5. Data model

A new collection keyed by workflow + book, so decomposition is per-curriculum and disposable/rebuildable:

```
bookintelligence {
  _id
  workflowId            // ties the book to the curriculum that sourced it
  step5SourceId         // links back to the exact Step 5 source
  bookRecord            // Stage 1 of the prompt (identity, rights mode, dominant mode)
  sourceMap             // Stage 2 (chapters with page ranges)
  nodes[]               // node passport (§ prompt) + mloIds[] + embeddingId + reviewStatus
  edges[]               // typed relationships (defines/supports/contradicts/…)
  reviewQueue[]
  qualityReport         // coverage, traceability, low-confidence count, readiness
  ingestDraft           // per-chapter checkpoint for resume (mirrors step13Draft)
  status                // queued | ingesting | needs_review | ready | failed
}
```

Each **node** is both a structured record (here) and a **vector-KB chunk** (its paraphrased `detailed_content` embedded, tagged with the node passport). Structured store = navigation/governance/citation; vector store = retrieval. One canonical home per idea (prompt Rule 3); other branches link by `nodeId`.

## 6. Governance & copyright (non-negotiable)

- **Store paraphrase + locators, not pages.** Nodes hold faithful paraphrase and _short_ essential quotes only, plus the `sourceLocation`. We never persist substantial verbatim text (prompt Rule 10). This keeps the KB lawful even for `academic_text` we hold a single licensed copy of.
- **`RIGHTS_MODE` gate** (private / internal / educational / commercial / public) drives what may be ingested and how content assets may later be used. Commercial/public modes require a stricter human-review pass.
- **Human-review queue** for: no establishable source location, low confidence, contradictions, or legal/medical/financial/safety interpretations (prompt Stage 10).
- **No fabrication, no derivative-of-derivative** (prompt Rules 4 & 6): downstream steps generate from _approved knowledge nodes_, and generated content never becomes a source node.

## 7. Phased delivery

- **P0 — Scope & rights.** Add the "ingestable?" filter to Step 5 sources (academic_text + file present + rights-cleared). UI: mark which sourced books to ingest.
- **P1 — Structure only.** Page-aware parser → Book Record + Source Map. Cheap, deterministic, no decomposition. Proves parsing/locators before spending LLM budget.
- **P2 — Knowledge layer.** Chapter-by-chapter, checkpointed decomposition → Meaning Map + Knowledge Assets (concepts / claims+evidence / frameworks / examples) into the node registry, scoped to the book's `mloIds` and `DEPTH`.
- **P3 — Retrieval.** Embed nodes into the vector KB with the passport metadata; make Steps 6–13 retrieve from it and stamp `sourceLocation` on generated artifacts. This is where curriculum quality visibly improves.
- **P4 — Higher branches & governance.** Learning / Application / Content assets, Agent Routing index, Quality Report + review-queue UI, readiness gate.

Ship P1→P3 first; that alone delivers cited, grounded curriculum. P4 is the "full package."

## 8. Risks & mitigations

| Risk                                                                        | Mitigation                                                                                                                   |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Copyright** — storing decomposed copyrighted books                        | Paraphrase + locators only; `RIGHTS_MODE` gate; short quotes only where permitted                                            |
| **Scale/cost** — a book = thousands of nodes; a single LLM pass can't do it | Chapter-scoped, checkpointed multi-pass (Step 13 pattern); bound by `DEPTH` and mapped MLOs, not "extract everything"        |
| **Locator fidelity** — plain text extraction loses page numbers             | Page-aware parser (PDF page map / EPUB spine) in P1; fall back to `chapter:section` locators and flag page-unknown to review |
| **KB pollution** — book nodes drowning existing sources                     | Namespace/tag by `bookId` + `workflowId`; retrieval filters; nodes carry `credibilityScore` so ranking still works           |
| **Interrupted long ingests**                                                | Reuse the checkpoint/resume + `maxStalledCount` fixes already in `stepQueue` / the Step 13 service                           |

## 9. Decisions (locked)

1. **Distinct stage — "Step 5.5 / Book Ingestion".** A dedicated background stage between Step 5 and Step 6, with its own status, queue and retry (reusing the generic `stepQueue` + the checkpoint/`maxStalledCount` fixes). It does **not** block or complicate Step 5 approval.
2. **SME opt-in per book.** Nothing decomposes automatically. On the Step 5.5 screen the SME marks which sourced, ingestable books to ingest — controlling LLM cost and copyright/rights exposure.
3. **Default depth `Standard`.** Important concepts, claims, examples and applications, scoped to the book's mapped MLOs. `Comprehensive`/`Forensic` only when explicitly chosen per book.
4. **Vector KB + `bookintelligence` collection.** Reuse the existing Atlas vector KB for retrieval; add a new `bookintelligence` Mongo collection for the structured node/edge registry, governance and citation. (The repo's `graphify` graph is a good conceptual model for the edges layer but is a dev tool, not runtime — runtime stays in Mongo.)

---

_Companion file: `book-ingestion-prompt.md` — the master prompt rewritten for this integration (runs post-sourcing, scoped to the sourced book's modules/MLOs, output aligned to this data model)._
