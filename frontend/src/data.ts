import step2SummaryCsvUrl from '../cell_count_summary.csv?url';
import rawCellCountCsvUrl from '../cell-count.csv?url';
import step4DataCsvUrl from '../step_4_data.csv?url';
import statTestResultsUrl from '../stat_test_results.json?url';
import step4SummaryUrl from '../step_4_summary.json?url';
import boxplotImageUrl from '../treatment_response_boxplot.png?url';

export const CELL_TYPES = ['b_cell', 'cd8_t_cell', 'cd4_t_cell', 'nk_cell', 'monocyte'] as const;

export type CellType = (typeof CELL_TYPES)[number];

export interface SummaryRow {
  sample: number;
  total_count: number;
  cell_type: CellType;
  population: number;
  percentage: number;
}

export interface RawRecord {
  project: string;
  subject: string;
  condition: string;
  age: number;
  sex: string;
  treatment: string;
  response: 'yes' | 'no';
  sample: string;
  sample_type: string;
  time_from_treatment_start: number;
  b_cell: number;
  cd8_t_cell: number;
  cd4_t_cell: number;
  nk_cell: number;
  monocyte: number;
}

export interface Step3StatResult {
  ttest_p: number;
  mw_p: number;
}

export type Step3StatResults = Record<CellType, Step3StatResult>;

export interface Step4Summary {
  project_counts: Record<string, number>;
  response_counts: Record<string, number>;
  sex_counts: Record<string, number>;
}

export interface Step4Row {
  subject: number;
  project: number;
  response: 'yes' | 'no';
  sex: 'M' | 'F';
  sample: number;
  sample_type: string;
  time_from_treatment_start: number;
}

export interface DashboardData {
  step2Rows: SummaryRow[];
  rawRecords: RawRecord[];
  step4Rows: Step4Row[];
  step3Stats: Step3StatResults;
  step4Summary: Step4Summary;
  boxplotImageUrl: string;
}

const numericFields = new Set([
  'sample',
  'total_count',
  'population',
  'percentage',
  'age',
  'time_from_treatment_start',
  'b_cell',
  'cd8_t_cell',
  'cd4_t_cell',
  'nk_cell',
  'monocyte',
]);

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const normalizedText = text.replace(/\r/g, '').trim();

  if (!normalizedText) {
    return [];
  }

  const [headerLine, ...dataLines] = normalizedText.split('\n');
  const headers = parseCsvLine(headerLine);

  return dataLines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = parseCsvLine(line);
      const record: Record<string, string> = {};

      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });

      return record;
    });
}

function coerceNumber(value: string): number {
  return Number(value.trim());
}

function parseSummaryRows(text: string): SummaryRow[] {
  return parseCsvRows(text).map((record) => ({
    sample: coerceNumber(record.sample),
    total_count: coerceNumber(record.total_count),
    cell_type: record.cell_type as CellType,
    population: coerceNumber(record.population),
    percentage: coerceNumber(record.percentage),
  }));
}

function parseRawRecords(text: string): RawRecord[] {
  return parseCsvRows(text).map((record) => ({
    project: record.project,
    subject: record.subject,
    condition: record.condition,
    age: coerceNumber(record.age),
    sex: record.sex,
    treatment: record.treatment,
    response: record.response as 'yes' | 'no',
    sample: record.sample,
    sample_type: record.sample_type,
    time_from_treatment_start: coerceNumber(record.time_from_treatment_start),
    b_cell: coerceNumber(record.b_cell),
    cd8_t_cell: coerceNumber(record.cd8_t_cell),
    cd4_t_cell: coerceNumber(record.cd4_t_cell),
    nk_cell: coerceNumber(record.nk_cell),
    monocyte: coerceNumber(record.monocyte),
  }));
}

function parseStep4Rows(text: string): Step4Row[] {
  return parseCsvRows(text).map((record) => ({
    subject: coerceNumber(record.subject),
    project: coerceNumber(record.project),
    response: record.response as 'yes' | 'no',
    sex: record.sex as 'M' | 'F',
    sample: coerceNumber(record.sample),
    sample_type: record.sample_type,
    time_from_treatment_start: coerceNumber(record.time_from_treatment_start),
  }));
}

async function loadTextAsset(assetUrl: string): Promise<string> {
  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`Failed to load ${assetUrl}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function loadJsonAsset<T>(assetUrl: string): Promise<T> {
  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`Failed to load ${assetUrl}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loadDashboardData(): Promise<DashboardData> {
  const [step2Csv, rawCsv, step4Csv, step3Stats, step4Summary] = await Promise.all([
    loadTextAsset(step2SummaryCsvUrl),
    loadTextAsset(rawCellCountCsvUrl),
    loadTextAsset(step4DataCsvUrl),
    loadJsonAsset<Step3StatResults>(statTestResultsUrl),
    loadJsonAsset<Step4Summary>(step4SummaryUrl),
  ]);

  return {
    step2Rows: parseSummaryRows(step2Csv),
    rawRecords: parseRawRecords(rawCsv),
    step4Rows: parseStep4Rows(step4Csv),
    step3Stats,
    step4Summary,
    boxplotImageUrl,
  };
}
