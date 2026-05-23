# Teiko Technical

This repository contains a small data-loading and analysis pipeline for cell-count data stored in CSV format and loaded into SQLite. The workflow is intentionally simple: ingest the raw file, query it with pandas, generate summaries, and produce a few downstream statistical outputs and plots.

## Database Schema

`load_data.py` creates a single table called `cell_count`. Each row represents one sample. The table includes everything in `cell-count.csv`

- Metadata and grouping fields: `project`, `subject`, `condition`, `age`, `sex`, `treatment`, `response`, `sample`, `sample_type`, `time_from_treatment_start`
- Measured cell counts: `b_cell`, `cd8_t_cell`, `cd4_t_cell`, `nk_cell`, `monocyte`

### Why this design 

Because the data is so small, and there isn't a high variance in the 
- One row per sample is easy to query and reason about.
- The fixed set of cell types fits naturally as columns, which makes percentage calculations and plotting straightforward.
- The schema is quick to load from CSV and easy to use from pandas.
- For the current scale, SQLite is sufficient and keeps the stack lightweight.

### How to scale it

With hundreds of projects and thousands of samples and more analytics, the schema would chnage to become more robust with a star model:

- Repeated subject attributes such as `age` and `sex` would be duplicated across many sample rows.
- Any expansion of the cell panel would require schema changes, backfills, and code updates.
- Analytical queries would become harder to maintain as more metrics, conditions, and timepoints are added.
- SQLite can handle this size, but concurrency, indexing strategy, and richer analytics would eventually push the project toward PostgreSQL or another database with stronger operational features.

- A `projects` table for project-level metadata.
- A `subjects` table for stable subject attributes such as demographic fields.
- A `samples` table for sample-level fields such as treatment, response, sample type, and collection time.
- A `cell_types` lookup table if the panel becomes dynamic.
- A `sample_counts` or `measurements` fact table containing one row per sample and cell type, rather than one column per cell type.

That design makes the model more flexible, avoids duplication, and scales better when the number of cell types or derived analytics grows. You can still expose a sample-wide view for convenience when plotting or summarizing.

## Improvements to the Current Schema

The present schema is workable, but it would benefit from a few structural changes:

- Add foreign keys and separate entity tables for projects, subjects, and samples.
- Add indexes on the most common filter columns, especially combinations involving `condition`, `sample_type`, `treatment`, `response`, and `time_from_treatment_start`.
- Consider storing cell measurements in long form if new cell types will be added frequently.
- If analytics will become broader, build materialized summaries or derived tables for common aggregates rather than recomputing them each time.

## Code Structure

The code is organized around a simple pipeline:

1. `load_data.py` Sets up  loads the CSV into SQLite.
2. `analysis.py` fetches data and performs reusable transformations.
3. `steps.py` drives the workflow and produces outputs.

That structure is practical because the repository is small and the workflow is linear. It also keeps the reusable analysis logic separate from the top-level execution script, which is a good starting point for future reuse.

## Repository Structure

- `load_data.py` builds the SQLite database from `cell-count.csv`.
- `analysis.py` provides reusable query and analysis helpers.
- `steps.py` orchestrates the end-to-end workflow and writes derived outputs such as summaries, statistics, and plots.

That split is sensible for a compact project. Ingestion is isolated from analysis, and the analysis helpers are separated from the execution script. For a small repository this keeps the moving parts easy to follow while still making the core logic reusable.
