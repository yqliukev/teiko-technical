import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  CELL_TYPES,
  type CellType,
  type DashboardData,
  type Step4Row,
  type SummaryRow,
  loadDashboardData,
} from './data';
import { buildStep3Series, RESPONSE_GROUPS } from './plot';

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});
const STEP_2_PAGE_SIZE = 20;
const STEP_4_PAGE_SIZE = 20;

function formatPValue(value: number): string {
  if (value < 0.001) {
    return '< 0.001';
  }

  return value.toFixed(4);
}

function formatCellType(cellType: CellType): string {
  return cellType.replace(/_/g, ' ');
}

function formatLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

type SchemaColumn = {
  name: string;
  type: string;
  note: string;
};

type SchemaTable = {
  name: string;
  summary: string;
  keySummary: string;
  columns: SchemaColumn[];
};

type DashboardStep = 1 | 2 | 3 | 4;

const STEP_NAV: Array<{ step: DashboardStep; label: string }> = [
  { step: 1, label: 'Step 1' },
  { step: 2, label: 'Step 2' },
  { step: 3, label: 'Step 3' },
  { step: 4, label: 'Step 4' },
];

const STEP_1_SCHEMA: SchemaTable[] = [
  {
    name: 'subjects',
    summary: 'One row per subject',
    keySummary: 'Primary key: subject',
    columns: [
      { name: 'project', type: 'INTEGER NOT NULL', note: 'Project id' },
      { name: 'subject', type: 'INTEGER PRIMARY KEY NOT NULL', note: 'Subject id' },
      { name: 'condition', type: 'TEXT NOT NULL', note: 'Study condition' },
      { name: 'age', type: 'INTEGER NOT NULL', note: 'Subject age' },
      { name: 'sex', type: 'TEXT NOT NULL CHECK (M | F)', note: 'Constrained to M or F' },
      { name: 'treatment', type: 'TEXT NOT NULL', note: 'Treatment assignment' },
      {
        name: 'response',
        type: 'TEXT CHECK (yes | no | blank when none)',
        note: 'Response status with treatment-aware constraint',
      },
    ],
  },
  {
    name: 'samples',
    summary: 'One row per sample',
    keySummary: 'Primary key: sample; foreign key: subject → subjects.subject',
    columns: [
      { name: 'sample', type: 'INTEGER PRIMARY KEY NOT NULL', note: 'Unique sample id' },
      { name: 'subject', type: 'INTEGER NOT NULL REFERENCES subjects(subject)', note: 'Subject link' },
      { name: 'sample_type', type: 'TEXT NOT NULL', note: 'Sample category' },
      {
        name: 'time_from_treatment_start',
        type: 'INTEGER NOT NULL',
        note: 'Timepoint relative to treatment start' ,
      },
      { name: 'b_cell', type: 'INTEGER NOT NULL', note: 'B cell count' },
      { name: 'cd8_t_cell', type: 'INTEGER NOT NULL', note: 'CD8 T cell count' },
      { name: 'cd4_t_cell', type: 'INTEGER NOT NULL', note: 'CD4 T cell count' },
      { name: 'nk_cell', type: 'INTEGER NOT NULL', note: 'NK cell count' },
      { name: 'monocyte', type: 'INTEGER NOT NULL', note: 'Monocyte count' },
    ],
  },
];

function App() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<DashboardStep>(1);
  const [selectedCellType, setSelectedCellType] = useState<CellType>('cd4_t_cell');
  const [summaryQuery, setSummaryQuery] = useState('');
  const [selectedSummaryCellType, setSelectedSummaryCellType] = useState<'all' | CellType>('all');
  const [step2Page, setStep2Page] = useState(1);
  const [step4Query, setStep4Query] = useState('');
  const [step4Page, setStep4Page] = useState(1);

  useEffect(() => {
    let active = true;

    loadDashboardData()
      .then((loadedData) => {
        if (active) {
          setDashboardData(loadedData);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const deferredSummaryQuery = useDeferredValue(normalizeSearchValue(summaryQuery));
  const deferredStep4Query = useDeferredValue(normalizeSearchValue(step4Query));

  useEffect(() => {
    setStep2Page(1);
  }, [deferredSummaryQuery, selectedSummaryCellType]);

  useEffect(() => {
    setStep4Page(1);
  }, [deferredStep4Query]);

  const step3Series = useMemo(() => {
    if (!dashboardData) {
      return null;
    }

    return buildStep3Series(dashboardData.rawRecords, selectedCellType);
  }, [dashboardData, selectedCellType]);

  const filteredStep2Rows = useMemo(() => {
    if (!dashboardData) {
      return [] as SummaryRow[];
    }

    const filteredRows = dashboardData.step2Rows.filter((row) => {
      const normalizedCellType = normalizeSearchValue(row.cell_type);
      const matchesQuery =
        deferredSummaryQuery.length === 0 ||
        String(row.sample).includes(deferredSummaryQuery) ||
        normalizedCellType.includes(deferredSummaryQuery);
      const matchesCellType =
        selectedSummaryCellType === 'all' || row.cell_type === selectedSummaryCellType;

      return matchesQuery && matchesCellType;
    });

    return [...filteredRows].sort((left, right) => {
      if (left.sample !== right.sample) {
        return left.sample - right.sample;
      }

      return CELL_TYPES.indexOf(left.cell_type) - CELL_TYPES.indexOf(right.cell_type);
    });
  }, [dashboardData, deferredSummaryQuery, selectedSummaryCellType]);

  const step2PageCount = Math.max(1, Math.ceil(filteredStep2Rows.length / STEP_2_PAGE_SIZE));

  useEffect(() => {
    setStep2Page((currentPage) => Math.min(currentPage, step2PageCount));
  }, [step2PageCount]);

  const step2RowsOnPage = useMemo(() => {
    const startIndex = (step2Page - 1) * STEP_2_PAGE_SIZE;
    return filteredStep2Rows.slice(startIndex, startIndex + STEP_2_PAGE_SIZE);
  }, [filteredStep2Rows, step2Page]);

  const filteredStep4Rows = useMemo(() => {
    if (!dashboardData) {
      return [] as Step4Row[];
    }

    const normalizedQuery = deferredStep4Query;

    return dashboardData.step4Rows
      .filter((row) => {
        if (normalizedQuery.length === 0) {
          return true;
        }

        const searchableFields = [
          String(row.subject),
          String(row.project),
          row.response,
          row.sex,
          String(row.sample),
          row.sample_type,
          String(row.time_from_treatment_start),
        ].map(normalizeSearchValue);

        return searchableFields.some((field) => field.includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (left.project !== right.project) {
          return left.project - right.project;
        }

        return left.sample - right.sample;
      });
  }, [dashboardData, deferredStep4Query]);

  const step4PageCount = Math.max(1, Math.ceil(filteredStep4Rows.length / STEP_4_PAGE_SIZE));

  useEffect(() => {
    setStep4Page((currentPage) => Math.min(currentPage, step4PageCount));
  }, [step4PageCount]);

  const step4RowsOnPage = useMemo(() => {
    const startIndex = (step4Page - 1) * STEP_4_PAGE_SIZE;
    return filteredStep4Rows.slice(startIndex, startIndex + STEP_4_PAGE_SIZE);
  }, [filteredStep4Rows, step4Page]);

  const step3StatRows = useMemo(() => {
    if (!dashboardData) {
      return [];
    }

    return CELL_TYPES.map((cellType) => ({
      cellType,
      ...dashboardData.step3Stats[cellType],
    }));
  }, [dashboardData]);

  if (error) {
    return (
      <main className="shell">
        <section className="panel panel--error">
          <p className="eyebrow">Dashboard unavailable</p>
          <h1>Unable to load the analysis dashboard</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!dashboardData || !step3Series) {
    return (
      <main className="shell shell--loading">
        <section className="panel panel--loading">
          <p className="eyebrow">Loading analysis results</p>
          <h1>Preparing the dashboard</h1>
          <p>Reading the existing step outputs and building the interactive views.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero panel">
        <div className="hero__copy">
          <p className="eyebrow">Teiko technical analysis</p>
          <div className="hero__badges">
            <span className="hero__badge">React</span>
            <span className="hero__badge">TypeScript</span>
          </div>
          <h1>Interactive Dashboard</h1>
        </div>
        <div className="hero__nav" role="tablist" aria-label="Choose analysis step">
          {STEP_NAV.map((item) => (
            <button
              key={item.step}
              type="button"
              role="tab"
              aria-selected={selectedStep === item.step}
              className={`hero__step-button ${selectedStep === item.step ? 'hero__step-button--active' : ''}`}
              onClick={() => setSelectedStep(item.step)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {selectedStep === 1 ? (
        <section className="panel section-card step1-card">
          <div className="section-card__header section-card__header--stacked">
            <div>
              <p className="eyebrow">STEP 1</p>
              <h2>Database schema</h2>
              <p>
                The pipeline loads the raw CSV into SQLite and splits it into two normalized tables:
                one for subject metadata and one for sample measurements
              </p>
            </div>
          </div>

          <div className="schema-grid">
            {STEP_1_SCHEMA.map((table) => (
              <article className="schema-card" key={table.name}>
                <div className="schema-card__heading">
                  <div>
                    <h3>{formatLabel(table.name)}</h3>
                  </div>
                  <div className="schema-pill">
                    <strong>{table.keySummary}</strong>
                  </div>
                </div>
                <div className="schema-card__summary">
                  <p>{table.summary}</p>
                </div>
                <div className="schema-table-shell">
                  <table className="schema-table">
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((column) => (
                        <tr key={column.name}>
                          <td>{column.name}</td>
                          <td>{column.type}</td>
                          <td>{column.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {selectedStep === 2 ? (
        <section className="panel section-card">
          <div className="section-card__header">
            <div>
              <p className="eyebrow">STEP 2</p>
              <h2>Cell count summary table</h2>
            </div>
            <div className="filters">
              <label className="field">
                <span>Search</span>
                <input
                  type="search"
                  value={summaryQuery}
                  onChange={(event) => setSummaryQuery(event.target.value)}
                  placeholder="Sample id or cell type"
                />
              </label>
              <label className="field">
                <span>Cell type</span>
                <select
                  value={selectedSummaryCellType}
                  onChange={(event) =>
                    setSelectedSummaryCellType(event.target.value as 'all' | CellType)
                  }
                >
                  <option value="all">All cell types</option>
                  {CELL_TYPES.map((cellType) => (
                    <option key={cellType} value={cellType}>
                      {formatCellType(cellType)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="table-shell">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Sample</th>
                  <th>Cell type</th>
                  <th>Population</th>
                  <th>Percentage</th>
                  <th>Total count</th>
                </tr>
              </thead>
              <tbody>
                {step2RowsOnPage.map((row) => (
                  <tr key={`${row.sample}-${row.cell_type}`}>
                    <td>{row.sample}</td>
                    <td>{formatCellType(row.cell_type)}</td>
                    <td>{numberFormatter.format(row.population)}</td>
                    <td>{percentFormatter.format(row.percentage)}%</td>
                    <td>{numberFormatter.format(row.total_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <p>
              Showing {filteredStep2Rows.length === 0 ? 0 : (step2Page - 1) * STEP_2_PAGE_SIZE + 1}
              {' '}
              to {Math.min(step2Page * STEP_2_PAGE_SIZE, filteredStep2Rows.length)} of{' '}
              {numberFormatter.format(filteredStep2Rows.length)} rows
            </p>
            <div className="table-pagination__controls">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setStep2Page((currentPage) => Math.max(1, currentPage - 1))}
                disabled={step2Page === 1}
              >
                Previous
              </button>
              <span className="table-pagination__status">
                Page {step2Page} of {step2PageCount}
              </span>
              <button
                type="button"
                className="pagination-button"
                onClick={() => setStep2Page((currentPage) => Math.min(step2PageCount, currentPage + 1))}
                disabled={step2Page === step2PageCount}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {selectedStep === 3 ? (
        <section className="panel section-card">
          <div className="section-card__header section-card__header--stacked">
            <div>
              <p className="eyebrow">STEP 3</p>
              <h2>Responder vs non-responder boxplot</h2>
              <p>
                Select a cell type to update the distribution
              </p>
            </div>
            <div className="celltype-tabs" role="tablist" aria-label="Select cell type">
              {CELL_TYPES.map((cellType) => {
                const statResult = dashboardData.step3Stats[cellType];
                const isSelected = cellType === selectedCellType;
                const isSignificant = Math.min(statResult.ttest_p, statResult.mw_p) < 0.05;
                const possiblySignificant = Math.min(statResult.ttest_p, statResult.mw_p) < 0.15;

                return (
                  <button
                    key={cellType}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`celltype-tab ${isSelected ? 'celltype-tab--active' : ''}`}
                    onClick={() => setSelectedCellType(cellType)}
                  >
                    <span>{formatCellType(cellType)}</span>
                    <small className={isSignificant ? 'celltype-tab__significant' : possiblySignificant ? 'celltype-tab__maybe' :''}>
                      {isSignificant ? 'significant' : possiblySignificant ? 'maybe' : 'ns'}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="step3-layout">
            <article className="chart-card">
              <div className="chart-card__heading">
                <div>
                  <h3>Generated boxplot</h3>
                </div>
                <div className="celltype-tabs">
                  <div className="stat-pill">
                    <span>t-test p</span>
                    <strong>{formatPValue(dashboardData.step3Stats[selectedCellType].ttest_p)}</strong>
                  </div>
                  <div className="stat-pill stat-pill--accent">
                    <span>Mann-Whitney p</span>
                    <strong>{formatPValue(dashboardData.step3Stats[selectedCellType].mw_p)}</strong>
                  </div>
                </div>
              </div>

              <img
                className="artifact-image artifact-image--featured"
                src={dashboardData.boxplotImageUrl}
                alt="Generated step 3 boxplot"
              />

            </article>

            <aside className="sidebar-stack">
              <article className="panel sidebar-card">
                <div className="sidebar-card__heading">
                  <div>
                    <p className="eyebrow">Statistical results</p>
                    <h3>STEP 3 significance table</h3>
                  </div>
                </div>
                <div className="stat-table-shell">
                  <table className="stat-table">
                    <thead>
                      <tr>
                        <th>Cell type</th>
                        <th>t-test p</th>
                        <th>Mann-Whitney p</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step3StatRows.map((row) => {
                        const selected = row.cellType === selectedCellType;
                        const significant = Math.min(row.ttest_p, row.mw_p) < 0.05;

                        return (
                          <tr key={row.cellType} className={selected ? 'stat-table__row--selected' : ''}>
                            <td>
                              <span className={significant ? 'stat-table__flag' : ''}>
                                {formatCellType(row.cellType)}
                              </span>
                            </td>
                            <td>{formatPValue(row.ttest_p)}</td>
                            <td>{formatPValue(row.mw_p)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            </aside>
          </div>
        </section>
      ) : null}

      {selectedStep === 4 ? (
        <section className="panel section-card">
          <div className="section-card__header">
            <div>
              <p className="eyebrow">STEP 4</p>
              <h2>Baseline subset table</h2>
              <p>
                The table below shows the Step 4 data.
              </p>
            </div>
            <div className="filters">
              <label className="field">
                <span>Search</span>
                <input
                  type="search"
                  value={step4Query}
                  onChange={(event) => setStep4Query(event.target.value)}
                  placeholder="Subject, project, response, sex"
                />
              </label>
            </div>
          </div>

          <div className="table-shell">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Project</th>
                  <th>Response</th>
                  <th>Sex</th>
                  <th>Sample</th>
                  <th>Sample type</th>
                  <th>Time from treatment start</th>
                </tr>
              </thead>
              <tbody>
                {step4RowsOnPage.map((row) => (
                  <tr key={`${row.subject}-${row.sample}`}>
                    <td>{row.subject}</td>
                    <td>{row.project}</td>
                    <td>{row.response}</td>
                    <td>{row.sex}</td>
                    <td>{row.sample}</td>
                    <td>{row.sample_type}</td>
                    <td>{row.time_from_treatment_start}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <p>
              Showing {filteredStep4Rows.length === 0 ? 0 : (step4Page - 1) * STEP_4_PAGE_SIZE + 1}
              {' '}
              to {Math.min(step4Page * STEP_4_PAGE_SIZE, filteredStep4Rows.length)} of{' '}
              {numberFormatter.format(filteredStep4Rows.length)} rows
            </p>
            <div className="table-pagination__controls">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setStep4Page((currentPage) => Math.max(1, currentPage - 1))}
                disabled={step4Page === 1}
              >
                Previous
              </button>
              <span className="table-pagination__status">
                Page {step4Page} of {step4PageCount}
              </span>
              <button
                type="button"
                className="pagination-button"
                onClick={() => setStep4Page((currentPage) => Math.min(step4PageCount, currentPage + 1))}
                disabled={step4Page === step4PageCount}
              >
                Next
              </button>
            </div>
          </div>

          <div className="step4-summary-stack">
            <div className="section-card__header section-card__header--stacked">
              <div>
                <h3>General subgroup summaries</h3>
                <p>
                  The counts below summarize projects, response status, and sex.
                </p>
              </div>
            </div>

            <div className="summary-groups">
              {[
                ['project_counts', 'Projects'],
                ['response_counts', 'Response'],
                ['sex_counts', 'Sex'],
              ].map(([key, title]) => {
                const entries = Object.entries(dashboardData.step4Summary[key as keyof typeof dashboardData.step4Summary]).sort(
                  (left, right) => right[1] - left[1],
                );
                const total = entries.reduce((sum, [, count]) => sum + count, 0);
                const maxCount = Math.max(...entries.map(([, count]) => count), 1);

                return (
                  <article className="panel summary-group" key={key}>
                    <div className="summary-group__heading">
                      <div>
                        <h3>{title} counts</h3>
                      </div>
                    </div>
                    <div className="bar-list">
                      {entries.map(([label, count]) => (
                        <div className="bar-row" key={label}>
                          <div className="bar-row__labels">
                            <span>{formatLabel(label)}</span>
                            <strong>{numberFormatter.format(count)}</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default App;
