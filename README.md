# Teiko Technical

This repository contains a small data-loading and analysis pipeline for cell-count data stored in CSV format and loaded into SQLite. The workflow is intentionally simple: ingest the raw file, query it with pandas, generate summaries, and produce a few downstream statistical outputs and plots.

## Running and Reproducing Results

Use the Makefile at the repository root to install dependencies, run the backend pipeline, and start the dashboard.

1. Install the Python and frontend dependencies:

```bash
make setup
```

2. Run the backend pipeline to regenerate the database, summary files, statistical results, and plot:

```bash
make pipeline
```

3. Start the dashboard locally:

```bash
make dashboard
```

The website will be hosted on `http://localhost:5173/` locally.

If you prefer to run the Python scripts manually, execute `python3 load_data.py` to rebuild `teiko.db`, then `python3 steps.py` to regenerate the analysis outputs.

## Database Schema

`load_data.py` creates two tables: `samples` and `subjects`.

`samples` uses its column for the primary key and includes information for each sample: `sample`, `subject`, `sample_type`, `time_from_treatment_start`, and the various cell counts. `subject` is a foreign key in this case. 

`subjects` includes metadata for each subject: `project`, `subject`, `condition`, `age`, `sex`, `treatment`, `response`

### Why this design 

Making the subject table separate from samples makes the the tables atomic nicely, reducing size, since subject table just repeated itself for samples with the subject.
Because the dataset was relatively small, and there weren't really relevant columns specific to it, `project` was just left within `subjects` (the only thing it was related to seemed to be `sample_type`). The other columns aren't unique enough to be indexed.

All things considered the schema is quick to load from CSV and easy to use from pandas.

### How to scale it

With hundreds of projects and thousands of samples and more analytics, the schema would need to become more robust:

- Any expansion of the cell panel would require schema changes, backfills, and code updates, so it's likely that cell information would get offloaded to its own table
- Analytical queries would become harder to maintain as more metrics, conditions, timepoints, and data in general are added, so a proper ingestion and preprocessing pipeline would need to be implemented. Data ingestion pagination may be needed so that processing memory isn't all used.
- In general, more tables would be needed as information becomes diverse, and more indices applied as defining columns become evident

An example schema might look something like this:
- A `projects` table for project-level metadata.
- A `subjects` table for stable subject attributes such as demographic fields.
- A `samples` table for sample-level fields such as treatment, response, sample type, and collection time.
- A `cell_types` lookup table if needed.
- A `sample_counts` or `measurements` fact table containing one row per sample and cell type, rather than one column per cell type.

## Code Structure

The code is organized around a simple pipeline:

1. `load_data.py` Sets up loads the CSV into SQLite.
2. `analysis.py` contains helper functions for fetching data, the transformations for the summary table, and creating the boxplot.
3. `steps.py` drives the workflow and produces outputs.
4. dashboard in `frontend` with all the needed data.

It's practical for the small and set tasks, while keeping the reusable analysis logic separate from the top-level execution script. Some of the statistical processes would be added into new functinos as common tasks emerged for a proper analytical pipeline. For similar reasons, as the task does not specify the type functionality for the dashboard, i only added some basic overview for the frontend, and it can be customized fully for common workflows and updated periodically with any job framework.
