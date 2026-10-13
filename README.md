# Gazette Metadata Workbench

Public site: https://cpenagent-sh.github.io/gazette-metadata-workbench/

The eGazette tab is built from the user's `egazette_documents.csv` (255,114 distinct `id` values, 27 Part & Section labels). It replaces the older scraped eGazette shards. All 22 source columns are retained in on-demand JSON shards at `data/eg/<part>__<issued-year>.json`; their ordering is in `data/eg_stats.json`. Selecting a row opens the supplied `stored_pdf_url` in an iframe beside the list. The site **does not contain any PDFs**. `pdf_url` opens the eGazette original in a new tab, which may no longer resolve. For 57 records, `stored_pdf_url` is blank and `failure_reason` explains the missing copy.

The archive.org tab and SCC tree are independent datasets. The SCC tree reads the existing Indian Legislation Explorer's public JSON. That repository is not modified.

To rebuild locally, place the source CSV at `/Users/shah/.hermes/attachments/egazette_documents.csv` or call `build_egazette_csv.build(dist_path, csv_path)` with another path. Run `python3 scripts/build_site.py` from the `egazette_context` workspace. This build also requires `corpus/meta/ia/ia_meta.csv` and `corpus/meta/scc_vs_ia/*.csv`. The build writes `site/dist`. Publish that directory to this repository's root, preserving `.nojekyll`.

Leaving Part & Section at **All Parts & Sections** loads a lightweight global index, sharded by issue year at `data/eg_index/<year>.json`. Search, category, year, and availability filters then span the entire CSV. Results are paginated at 1,000 per page; selecting a row fetches its full metadata shard only on demand. The filtered CSV button exports **all matching records**, including matches beyond the current page and across sections, by fetching the needed full shards. A very large export asks for confirmation. Part & Section is included as the first column. The source CSV itself is not committed to this repository.
