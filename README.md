# ZME Position Companion

A second-monitor web app for ZME (Memphis ARTCC) VATSIM controllers. It has five position pages (DEL, GND, TWR, APP/DEP, CTR), each keyed to the airport and flow you're working, so you can answer "what initial altitude, which SID, what departure freq, who do I hand off to" without opening a PDF.

> **VATSIM use only.** Every ZME document says it "shall not be used for real world operations", and so does this app. It has no affiliation with the real-world Memphis ARTCC or the FAA.

## Quick start

```sh
npm ci
npm run dev          # http://localhost:5173
npm run build        # validate data → cross-check sources → typecheck → dist/
npm test             # unit + acceptance checks (vitest)
npm run test:e2e     # browser acceptance checks at 1080p and phone size (Playwright; build first)
npm run smoke:dev    # push the entry points through the dev server's transform pipeline
```

## What's on each page

Every position page has the same top bar (airport, flow, MEM Night toggle, search), a sticky strip showing your frequency → the next handoff (tap to copy), and the same four tabs: **Cheat sheet · Scripts · Reference · Docs**.

| Page | Cheat sheet highlights |
|---|---|
| DEL | Active flight → SID, runway, initial fix, initial altitude, departure frequency; PDC-or-voice checker; RNAV SID table by runway (night-only SIDs hidden unless Night is on) |
| GND | Direction of flight (from the SID's ELVIS gate) → taxi-by-direction runways for the flow; crossings; what's delegated to Local |
| TWR | Takeoff clearance (`RNAV to <fix>` or a heading), runway configuration, departure heading table for the flow, go-around coordination |
| APP/DEP | M03 positions and staffing order, feeder → final altitudes, STAR → runway, scratchpads, satellite tower open/closed status |
| CTR | Split picker (area / LO / HI / UH); pick your sector to filter AIT step cards; external LOA restrictions; top-down covering panel |
| Strips | 7110.65 departure/arrival/overflight strip, box for box, with copy-per-box, a TBL 2-3-10 equipment-suffix derivation and the TBL 2-3-11/12 annotation palette |
| Library | All 40 ZME files with version, ZME "Updated" date, and which pages cite them; FAA d-TPP chart links for the current AIRAC |
| Discrepancies | Every value two ZME documents disagree on, plus open questions for staff |

It installs as a PWA and works offline after the first load.

## Data: where every fact comes from

All content lives in `data/*.yaml`. The UI is a pure function of (position, airport, flow, night, active flight) over that data.

- **`data/docs.yaml`** is the source registry: one entry per ZME file, with the ZME Files page ID (`site_id`), its "Updated" date when transcribed (`site_updated`), and version/revision. Source tags link to `https://memphisartcc.com/files/<site_id>/download`.
- Every record carries `src: <doc-id>#<section>`, e.g. `src: kmem-atct-sop#2-1-2`. Nothing is typed from memory.
- Values that disagree between documents carry `flag: Dn` (or `flags: { Dn: [field, …] }`) pointing at `data/discrepancies.yaml`. The app shows the printed value with a ⚠ badge, and tapping it lists every source's value.

### Pipeline

1. **Transcribe** from the PDF into YAML by hand. PDF text extraction of some files is unreliable (the Minor Field Reference comes out garbled).
2. **`npm run validate`** checks the schema (`schema/schema.ts`): every record has a source; every source doc and discrepancy exists; every frequency matches `1[1-3]x.xx(x)` (localizers use the NAV band); every runway exists in its airport's runway list; SIDs, ELVIS transitions, sectors and flows referenced by other records exist. The Vite plugin runs the same check, so a bad record fails `npm run dev` and `npm run build`.
3. **`npm run crosscheck`** compares values that appear in two sources: callsign ↔ frequency, airport initial altitude ↔ Reference Card guidance, and Reference Card SID fixes ↔ the RNAV Departure References (`dep_ref`), runway by runway. A conflict with no discrepancy flag fails the run.
4. **`npm run build`** produces a static PWA in `dist/`. `base: './'`, so it works from any static host or a subpath.

**Hosting.** `.github/workflows/pages.yml` rebuilds on every push to `main` and pushes `dist/` to the `gh-pages` branch, served at https://elluveride.github.io/ZMECompanion/ (Settings → Pages → Deploy from a branch → `gh-pages` / root).

**Staleness watch.** `.github/workflows/staleness.yml` runs `scripts/staleness.ts` daily. It reads `https://memphisartcc.com/files/all`, compares each file's "Updated" date to `site_updated`, and opens (or comments on) an issue when a file is newer, new, or removed. You can run it locally with `npm run staleness`.

**To update content:** edit the YAML, run `npm run validate && npm run crosscheck`, bump `site_updated`/`version` in `docs.yaml`, then open a PR. CI runs everything, including the browser acceptance checks.

## Coverage

| Area | Status |
|---|---|
| MEM tower cab, M03, ZME enroute | Full MVP: positions, flows, 18 RNAV SIDs + ELVIS/18 transitions, headings, taxi table, STARs, scratchpads, feeder altitudes, sectors/splits, 18 AIT procedures, external LOA summary |
| BNA | Positions (cab + TRACON), flows, 9 RNAV SIDs, DTA heading rules, STAR names, arrival restrictions |
| LIT, HSV | Positions, flows, initial altitude, heading rules (LIT), Reference Card facts |
| JAN, OLV, NQA, PAH, XNA | Minor Field Reference: positions, hours, initial altitude, departure-frequency order, releases, GND/LC procedures |
| Other minor fields (ASG, CGI, MKL, TUP, …) | Not yet transcribed. Data-only additions to `airports.yaml` / `positions.yaml` |

## Discrepancies and open questions

`data/discrepancies.yaml` holds 13 open conflicts: the 7 from the MVP spec (D1–D7) and 6 found while transcribing (D8–D13). Among them: BUBBY vs BUBYY at BNA, MONAA vs MONNA, LIT calm-wind northeast vs 22R, and an AIT route boundary of Q34 vs J42. `data/questions.yaml` lists questions for staff (squawk ranges, boxes 10–18, vStrips import, the deleted sector 42, and a shared 120.600 at BNA). They all show on the Discrepancies page.

## Not in this MVP

Live VATSIM data, login, training records, and rehosting PDFs or charts (everything links out). Wake category isn't derived for strips, because the type → CWT category list isn't in the ZME files.
