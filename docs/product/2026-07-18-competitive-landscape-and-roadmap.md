# CompBrain Product Strategy: From Dashboard to Sovereign Company Brain

> Deep competitive + feature + distribution research (2026-07-18). Synthesized from 6 parallel web-research passes (113 searches) across category leaders, sovereign/OSS players, agentic/vertical products, interface surfaces, feature building blocks, and GTM/moats.

## 1. Verdict

CompBrain today is a single-surface RAG demo — and the market has already declared that shape dead (Weaviate *archived* Verba, its own "chat with your docs" app, and pivoted to agents; the founder's "just a dashboard" worry is correct, not paranoid). To be sellable, CompBrain must become **one permission-aware, sovereign knowledge core exposed through many front doors** — in-app chat, messaging bots, email, API/MCP, and voice — where every answer is cited to the exact source and *nothing ever leaves the customer's infrastructure*. But sovereignty alone is now table stakes: Onyx ships a free, air-gapped, permission-aware RAG platform, and Cohere North, Squirro, and Worqlo already sell on-prem to regulated buyers. The only durable wedge is the **combination no incumbent can copy**: fully self-hosted deployment + a regulated-vertical workflow + the founder's genuine, un-cloneable edge in **on-prem speech/audio ingestion** (turning recorded calls and meetings into cited, searchable knowledge that never touches a cloud transcription vendor). Win narrow — one vertical, sovereignty, speech — then broaden.

---

## 2. Competitive Landscape

| Player | What it is (one line) | On-prem / air-gapped? | Main interfaces | Rough pricing |
|---|---|---|---|---|
| **Glean** | Category-leading neutral "Work AI" search + assistant + agents over 275+ apps | **Cloud-Prem only** (single-tenant in *your* cloud, Glean-operated); true on-prem only via new Dell hardware partnership | Web, Slack, Teams, browser ext, desktop, mobile, API, MCP | ~$50–75/user/mo, ~100-seat min, ~$60k floor → $350–480k TCO |
| **Microsoft 365 Copilot** | AI woven into Office + Graph | **No** — Azure cloud only | Word/Excel/Teams/Outlook, Copilot Chat | $30/user/mo (biz $21) |
| **Google Gemini Enterprise** | Agentic search + assistant on Google Cloud | **No** (cloud-hosted) | Web, Workspace, agent console | ~$21–60/user/mo |
| **Cohere North** | Sovereign agent platform on Cohere's own models | **Yes — on-prem + air-gapped, 2 GPUs** | Web workspace, search, MCP | Custom enterprise |
| **Onyx (ex-Danswer)** | Open-source (MIT) self-hosted RAG + agents — *the direct template* | **Yes — fully air-gapped, free** (UCSD runs it air-gapped, 37k users) | Web, Slack bot, API, MCP | Free OSS; Enterprise custom |
| **Squirro** | Sovereign on-prem GenAI for regulated banks (Gartner Leader) | **Yes — full on-prem / sovereign** | Web, API, embed | Six-figure+ |
| **Credal** | Governance/control-plane for enterprise agents | **Yes — VPC / air-gapped K8s** | Slack, web, custom frontend, API | Enterprise |
| **Hebbia** | Vertical agentic doc analysis (finance/legal), "grid not chat" | On-prem option | Web grid (Matrix), API, MCP | ~$10k/seat/yr |
| **Harvey** | Vertical legal AI agents + Vault | Cloud (enterprise posture) | Web, Word, Vault | ~$1,000–2,000/seat/mo |
| **Guru** | Verified-answer knowledge base + search | Cloud SaaS | Web, Slack, Teams, ext | ~$25/seat/mo → usage credits |
| **Mattermost Agents** | Self-hosted Slack alternative + BYO-LLM AI | **Yes — self-hosted / air-gapped** | Self-hosted chat, bots | OSS + Enterprise |
| **Worqlo** | Self-hosted regulated-industry entrant | **Yes — air-gapped, HIPAA BAA** | Web, customer infra | Custom |

**Where the market is, and where a sovereign entrant wins vs loses.** The market moved from *search* → *cited assistant* → *agents that do work*; a citations-only dashboard is behind the frontier, and raw on-prem RAG is now a *free commodity* (Onyx). Every cloud leader — Copilot, Gemini, Notion, Coveo, Slack AI, Rovo — is structurally locked out of true air-gap, and even Glean's "Cloud-Prem" runs in *your cloud under Glean's control*, not a customer-operated install. **CompBrain wins** where data egress is a hard legal blocker (banks barred from public cloud — Squirro's exact proven ICP), where >40% of knowledge lives outside Microsoft, where local language/voice matters (CIS/MENA), and where buyers are too small/regional for Glean's ~100-seat, ~$100k floor. **CompBrain loses** head-to-head in Microsoft-committed shops (Copilot inherits trust cheaply), in generic horizontal multi-SaaS search (Glean's connector breadth + free Onyx dominate), and against Cohere North/Squirro *if* it competes on "we're on-prem" alone. The escape from all three losing games is the same: **vertical depth + speech + local language on top of sovereignty.**

---

## 3. The Product Surface CompBrain Needs (Feature Catalog by Module)

### Module A — Permission-Aware Cited Chat *(the immediate next build)*
**What:** Natural-language Q&A over the workspace corpus with **inline citations that deep-link to the exact page / paragraph / cell / timestamp**, plus an "insufficient evidence → refuse" guardrail and a citation-coverage/confidence score.
**Why regulated buyers need it:** In a bank or hospital, an uncited or hallucinated answer is a liability event; auditability *is* the product. This is what turns the "TRUSTWORTHY" pillar from a slogan into a procurement checkbox.
**Proven by:** Every serious player — Glean, Onyx, Hebbia (92% cited-accuracy vs 68% naive RAG), Guru, Abridge ("Linked Evidence").

### Module B — Permission-Aware Retrieval / ACL Mirroring *(non-negotiable table stakes)*
**What:** Sync each source system's native ACLs (SharePoint/Confluence/AD groups, nested groups, folder trees) at **both index-time and query-time**, so an answer can *never* cite a document the asking user couldn't open.
**Why:** This is the single most load-bearing feature for regulated buyers and the first thing a CISO security review tests. Pre- or post-filtering alone fails a strict audit.
**Proven by:** Glean's stated core moat; Onyx (Enterprise-gated); M365 Copilot + Purview; Squirro. *Make it default and near-real-time — beat Onyx, which paywalls it.*

### Module C — Ingestion of ALL Data Types, incl. Audio/Calls *(the flagship differentiator)*
**What:** Parse→chunk→embed for docs (done), plus **self-hosted ASR + speaker diarization** for call recordings, meetings, and voice notes → every spoken sentence becomes a citable source with timestamp + speaker; plus on-prem OCR/VLM for scanned contracts, IDs, diagrams, stamped forms.
**Why:** Call recordings are a massive, compliance-mandated, currently-*dark* data source in banks (MiFID II / FINRA force 3+ year retention of trading and branch calls). No cloud tool (Otter, Fireflies, AssemblyAI) can touch air-gapped audio.
**Proven by:** Sana's $1.1B exit was built on making meetings queryable; Abridge/Ambience are Best-in-KLAS on audio→cited output; but **not one competitor self-hosts speech.** This is the founder's edge made into a product.

### Module D — Assistants / Agents & Bounded Actions
**What:** A no-code builder to spin up **scoped, persona'd assistants over a data subset** ("Compliance Assistant" limited to regulatory docs; "Credit Policy" agent), each with its own ACLs and model choice; plus **bounded, auditable playbook agents with human-in-the-loop** (e.g., NDA redline, KYC-completeness check) and a Deep-Research agent that returns a cited internal report.
**Why:** Regulated buyers trust *narrow, escalating* actions before autonomy; the builder also lets you sell the same brain as many internal "products."
**Proven by:** Glean Agent Builder, Dust, Onyx assistants, Robin AI (playbook + write-back + escalate), Harvey Workflow Builder.

### Module E — Multi-Surface Access Layer *(fixes "just a dashboard")*
**What:** One permission-aware core answering through in-app chat + Telegram/Slack/Teams/Mattermost bots + email-in + REST/Chat API + MCP server + voice. (Full spec in §4.)
**Why:** Adoption and stickiness come from "answer in the tool you're already in." Multi-surface is how Glean defends against suite incumbents — it's not a nice-to-have.
**Proven by:** Glean (~9 surfaces off one graph), Khoj (Browser/Obsidian/Desktop/Phone/WhatsApp off one self-hosted brain).

### Module F — Governance / DLP / Audit / Admin
**What:** Immutable, queryable answer-provenance log (who asked, which chunks/ACLs evaluated, which model saw what); continuous oversharing/PII/PHI scan with auto-hide; prompt-level DLP; retention controls; a pre-go-live "oversharing assessment" report; SSO (SAML/OIDC), RBAC.
**Why:** "Will it leak?" is the #1 buying objection — Microsoft's own framing is *"Copilot doesn't create oversharing, it exposes it."* Turning that fear into a report is a paid upsell and an EU-AI-Act (applicable Aug 2 2026, fines to 7% of turnover) traceability answer.
**Proven by:** Glean Protect, M365 Purview, Credal (PII never leaves VPC), Squirro audit trails.

### Module G — Verification & Freshness (Trust beyond citations)
**What:** SME-assigned content owners, scheduled re-verification, trust scores, auto-flagging of stale/superseded policy as "unverified," a "verified/approved" badge shown on every surface.
**Why:** A *cited* answer to a *superseded* circular is still wrong — a real liability in regulated shops. RAG-native competitors lack this.
**Proven by:** Guru (Verified Answers + SME loop) — an underrated, defensible building block.

### Module H — Knowledge-Gap Analytics
**What:** Dashboard of top questions, unanswered/low-confidence queries, duplicate questions, and "documents people need that don't exist."
**Why:** Cheap, early, high-ROI — proves value to the buyer *and* generates a content backlog flywheel. A demo-day metric and a content engine in one.
**Proven by:** Question Base (automates 90%+ of repeat questions), Glean Insights.

---

## 4. Multi-Surface Access Strategy

Architectural rule that governs *all* of these: **enforce document-level permissions ONCE at retrieval, before content reaches the LLM, then reuse that filter on every surface.** Any surface that skips the re-check is a data leak.

| Surface | Value | Effort | Security tradeoff for regulated buyers |
|---|---|---|---|
| **In-app web chat** | The home base; richest UX, full citations, admin controls | **Low** (extend existing dashboard) | Fully inside the perimeter — the cleanest sovereignty story. |
| **Telegram bot** | Flagship for CIS/MENA — Telegram is the primary messaging app in Uzbekistan/Kazakhstan and on trading desks; a distribution wedge Glean ignores | **Low–Med** | **Honest tension:** messages transit Telegram's cloud. Mitigate with **self-hosted Bot API server**, SSO identity-binding, whitelist, **read-only answer scope** (never expose raw source docs), content sanitization vs prompt injection, immutable audit. The bot token is a master password — protect it. Frame it as "ask-only, we don't hoard your chats." |
| **Email-in (forward a question)** | Zero adoption friction for non-technical compliance/legal/ops staff; stays in the mail perimeter | **Low** | On-prem/Exchange mail stays inside; good sovereignty fit. |
| **Public REST/Chat API + MCP server** | Lets internal tools/IDEs (Cursor, Claude Desktop) query the brain; **a fully self-hosted MCP is a clean differentiator** — Glean's MCP still routes through Glean infra | **Med** | Runs entirely on-prem with ACL + audit at the boundary — the sovereign version hosted competitors can't match. |
| **Slack bot** | Reach where US/global teams live | **Med** | **Two red flags:** (1) Slack is cloud-only; (2) Salesforce's May 29 2025 API terms *ban* persistent indexing of Slack data — Glean literally lost this. **Use Slack only as a query-by-query ask surface; never pull Slack history into the brain.** Make "we don't hoard your chat data" a selling point. |
| **Microsoft Teams bot** | Enterprise chat ubiquity | **Med–High** | Transport routes through Azure Bot Framework + Entra ID — friction for zero-egress. Bot logic self-hosted, but the transport is Microsoft cloud. Support it, keep the brain on-prem. |
| **Browser extension / sidebar** | Power-user "answer on any tab" | **Med–High** | Fine on-prem; lower priority than messaging for regulated non-technical staff. |
| **VOICE — call/meeting ingestion + voice queries** | **The founder's unfair edge.** Self-hosted meeting bot / local capture → on-prem ASR + diarization → cited, timestamped, speaker-attributed knowledge; plus dictate-a-question / hear-a-cited-answer via on-prem TTS | **High** (but it's the moat) | Fully sovereign by design — audio *never leaves the building*. This is precisely why Vexa/Meetily exist ("every cloud solution failed our privacy requirements"). |

**Build first (recommended): (1) In-app cited chat → (2) Telegram bot → (3) self-hosted MCP + REST API.** In-app chat is the immediate step on top of what exists and makes the product demoable. Telegram is the highest-leverage, lowest-effort *distribution* wedge for the founder's actual geography and buyers, and it directly answers the "usable anywhere" ask. MCP/API is low-marginal-effort reuse of the same retrieval core and gives a credible "sovereign integration" story to technical buyers. **Voice is the differentiator but comes right after** — it's higher-effort and is the thing you sell the vision on, not the thing you ship week one. Defer Slack/Teams/browser-ext until a design partner explicitly demands them.

---

## 5. Differentiation / Unfair Edge

CompBrain's moat is a **bundle no single competitor holds**, anchored on two things the cloud leaders *structurally cannot do*:

1. **True customer-operated air-gap with self-hosted models.** Copilot/Gemini/Notion/Coveo/Slack/Rovo are cloud-only. Glean is "in your cloud, run by Glean." The founder owning A100/H100 + self-hosted LLMs is the same structural key that lets Writer (Palmyra Instance) and Cohere (North) go on-prem while API-dependent Glean/Dust cannot. Ship a hardened Docker/K8s/Terraform bundle with local LLM + embeddings + reranker + ASR, an **offline-license flow and per-model GPU sizing tables modeled on GitLab Duo Self-Hosted** (the pattern regulated IT benchmarks against), plus a "zero data egress" verification kit (network allow-list, offline-operation attestation, a live "this instance made zero external calls" dashboard) — turning SOVEREIGN from a claim into something a security reviewer can *verify*.

2. **On-prem speech/audio — the genuinely un-cloneable edge.** *Not one competitor* (Glean, Onyx, Dust, Guru, Squirro, Hebbia, Cohere, Mistral) deeply ingests calls/meetings/voice notes on the customer's own hardware. Own the sentence: **"the only brain that turns your recorded calls into cited, searchable knowledge without the audio ever leaving your building."** Extend Abridge's "Linked Evidence" trust primitive to *every* modality — click a claim, jump to the PDF paragraph, the image region, *or* play back the exact timestamped, speaker-attributed audio segment inline. Concrete regulated use cases the incumbents can't serve: MiFID II/FINRA call-recording archives made searchable; compliance auditing of branch/trading/support calls ("flag any mention of a data breach in overnight calls") entirely on-prem; ambient meeting capture as first-class knowledge.

3. **Local-language depth as geo-arbitrage.** First-class Uzbek/Russian retrieval, transcription, and answers — the Tilmoch/Navai local-winner pattern. Glean/Cohere/Copilot are English-first; voice + low-resource language is exactly the barrier a localizer owns and the bundlers won't chase.

The moat is the *combination*: sovereign + speech + local-language + a regulated-vertical workflow. Any one alone is copyable; together they are not.

---

## 6. Prioritized Roadmap

**Already done:** email/password auth, workspaces, PDF/Word/txt/md upload, parse→chunk→embed→pgvector, dashboard.

### NOW (next 4–8 weeks) — make it answer, and make it demoable
- **Ship Module A: permission-aware cited chat.** Retrieval over the existing pgvector index → grounded answers with **inline deep-link citations** + "insufficient evidence" refusal. This is the single step that converts "dashboard" into "product." *(This is the already-specced Plan 3 — Ask & Citations.)*
- **Minimum permission model (Module B, v0):** workspace + per-folder/source scoping and RBAC now; real source-ACL *sync* comes with connectors later — but the *architecture* must filter at retrieval from day one.
- **Telegram bot (ask-only, read-only scope):** fastest path to "usable anywhere" and to a design partner's hands, in the founder's actual market.
- **Answer-provenance audit log (Module F, v0):** log every query, retrieved sources, user. Cheap now, load-bearing for every future regulated demo.

### NEXT (roughly 2–4 months) — the wedge that only you can build
- **Module C speech pipeline:** self-hosted Whisper-class ASR + diarization; audio becomes cited, timestamped, speaker-attributed knowledge. **Linked-Evidence audio playback** in the chat UI. This is the differentiator — prioritize it over more connectors.
- **Self-hosted MCP server + REST/Chat API:** reuse the retrieval core; unlocks technical buyers and "sovereign integration."
- **Air-gapped deployment SKU:** Docker/K8s bundle, offline-license flow, GPU-sizing docs, zero-egress verification kit.
- **Regulated-first connectors, ordered by ICP:** network file shares/SMB, on-prem SharePoint, Exchange/Outlook, internal DBs — the sources SaaS leaders *cannot reach*. Start with 3–4, not 40.
- **Knowledge-gap analytics (Module H):** cheap ROI story for the buyer.

### LATER — depth and defensibility
- **Scoped assistant/agent builder (Module D)** + bounded playbook agents with human-in-the-loop.
- **Governance/DLP suite (Module F full):** oversharing assessment, PII/PHI auto-hide, prompt DLP, retention, SSO/SAML — the compliance evidence pack that gates deals.
- **Verification/freshness (Module G)** and **on-prem OCR/VLM** for scanned docs.
- **Vertical starter pack** (banking compliance: KYC/AML review, complaint-call analysis, credit-memo drafting) — sell a *solution*, not a blank builder.
- Additional surfaces (Slack/Teams/Mattermost/browser-ext/voice-query TTS) as design partners demand.

**Solo-founder reconciliation:** the multi-surface vision is real but must be *sequenced* — one permission-aware core, surfaces added cheaply *because they reuse it*, not built in parallel. Resist connector sprawl (see §8). Use founder-led **forward-deployed setup** (the Hebbia/Harvey moat) to win 1–2 lighthouse regulated accounts at high ACV rather than chasing volume — regulated sales cycles run 9–18 months with 4–8 week security reviews, so land tight single-use-case pilots and productize compliance artifacts early.

---

## 7. Ten Standout Feature Ideas (ranked)

1. **Sovereign call intelligence** — self-hosted ASR + diarization turning recorded calls/meetings into cited, timestamped, speaker-attributed searchable knowledge, audio never leaving the network. The un-cloneable edge; no competitor self-hosts speech.
2. **Linked Evidence across every modality** — click any claim in an answer to jump to the exact PDF paragraph, image region, *or* play the exact audio segment inline. Extends Abridge's strongest trust feature to voice + vision.
3. **Cited chat with "insufficient evidence" refusal + citation-coverage score** — grounded answers that decline rather than hallucinate; the founder's LLM-reliability edge sold as a "no-hallucination in regulated contexts" guarantee.
4. **Sovereign Telegram bot (ask-only, identity-bound, audited)** — meets CIS/finance staff where they already are, a distribution channel Glean structurally ignores.
5. **Self-hosted MCP server** — the Glean-MCP value prop but fully air-gapped; plug the brain into Cursor/Claude Desktop/internal tools with ACL + audit at the boundary.
6. **Zero-egress verification kit** — network allow-list config + offline-operation attestation + a live "this instance made zero external calls" dashboard a CISO can hand to auditors. Turns SOVEREIGN from claim to proof.
7. **Real-time source-ACL mirroring, default (not paywalled)** — sync SharePoint/AD/Confluence permissions at index + query time so a citation can never surface a doc the asker can't open. Beats Onyx, which gates this behind Enterprise.
8. **Oversharing-assessment + PII/PHI auto-hide report** — pre-go-live scan that answers "will it leak?" before the buyer asks; a paid governance upsell (Purview/Glean-Protect equivalent, on-prem).
9. **Verified-answer badge with expiry** (Guru-style) — SME-approved answers marked current vs "unverified/stale policy," shown on every surface. A cited answer to a superseded circular is still wrong; this fixes it.
10. **Banking-compliance vertical starter pack** — prebuilt agents/playbooks (KYC/AML review, complaint-call analysis, MiFID call-audit, credit-memo drafting) so CompBrain lands as a solution commanding vertical pricing (Harvey/Hebbia prove ~20x horizontal per-seat).

---

## 8. Traps, What NOT to Build, and Honest Risks

**Do NOT build:**
- **A 40-connector land-grab.** Connector breadth is Glean's moat and a maintenance treadmill that will crush a solo founder; each SaaS connector needs perpetual ACL/API upkeep. Build *only* the regulated on-prem sources your first buyers actually have (file shares, Exchange, on-prem SharePoint), and support running on their **existing** Elastic/Weaviate + vLLM as a procurement unlock rather than rip-and-replace.
- **"On-prem RAG with citations" as the pitch.** Onyx already ships that free (MIT), air-gapped, ACL-aware. Sovereignty is table stakes — never the headline. The headline is *speech + vertical + local language on sovereign infra*.
- **Indexing Slack.** Salesforce's May 2025 terms ban persistent Slack indexes; don't architect around a source you can't legally hoard.
- **Open-ended autonomous agents.** Regulated trust is won by *bounded, auditable, human-in-the-loop* actions, not autonomy. Start with narrow playbooks that escalate.
- **A generic horizontal "company brain."** You cannot out-breadth Glean or out-bundle Microsoft. Pick one vertical.

**Honest risks:**
- **Microsoft/Glean gravity.** Microsoft-committed shops get "good enough" AI near-free via Copilot; you will lose them and shouldn't chase them. Your buyer is the one Copilot *can't* serve — cloud-prohibited, audio-heavy, non-Microsoft, regional.
- **The Telegram vs sovereignty tension is real and must be disclosed.** A Telegram bot's messages transit Telegram's cloud, which partially contradicts the zero-egress promise. Be honest with buyers: keep it ask-only, read-only, identity-bound, self-hosted Bot API, audited — and offer self-hosted Mattermost as the fully-sovereign chat alternative for the strictest buyers.
- **A well-capitalized sovereign incumbent already exists.** Cohere North (RBC, Palantir pilots) and Squirro (Gartner Leader, national banks) hold your positioning with far more capital. You cannot match them on brand or breadth — you out-*verticalize*, out-*localize* (Uzbek/Russian voice), and out-*speech* them, and you win the mid-market regional banks they won't chase.
- **Regulated sales are slow and evidence-heavy** (9–18 mo, SOC 2 / HIPAA BAA / EU AI Act packs upfront). Productize compliance artifacts early and win 1–2 lighthouse accounts founder-led rather than pursuing volume.
- **Speech is your moat *and* your execution risk.** It's the highest-effort surface and the reason to buy CompBrain — resource it as the core, not a side project, and don't let connector or surface sprawl starve it.
