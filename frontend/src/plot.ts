import { CELL_TYPES, type CellType, type RawRecord } from './data';

export type ResponseGroup = 'no' | 'yes';

export const RESPONSE_GROUPS: ResponseGroup[] = ['no', 'yes'];

export interface BoxPlotPoint {
  sample: string;
  response: ResponseGroup;
  percentage: number;
  population: number;
  totalCount: number;
}

export interface BoxStats {
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  lowerWhisker: number;
  upperWhisker: number;
  outliers: number[];
}

export interface BoxPlotSeries {
  cellType: CellType;
  points: BoxPlotPoint[];
  stats: Record<ResponseGroup, BoxStats>;
  domainMax: number;
}

function quantile(sortedValues: number[], proportion: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const position = (sortedValues.length - 1) * proportion;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(sortedValues.length - 1, lowerIndex + 1);
  const weight = position - lowerIndex;

  return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight;
}

function summarize(values: number[]): BoxStats {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      mean: 0,
      lowerWhisker: 0,
      upperWhisker: 0,
      outliers: [],
    };
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const q1 = quantile(sortedValues, 0.25);
  const median = quantile(sortedValues, 0.5);
  const q3 = quantile(sortedValues, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const insideFence = sortedValues.filter((value) => value >= lowerFence && value <= upperFence);
  const outliers = sortedValues.filter((value) => value < lowerFence || value > upperFence);
  const lowerWhisker = insideFence[0] ?? sortedValues[0];
  const upperWhisker = insideFence[insideFence.length - 1] ?? sortedValues[sortedValues.length - 1];
  const mean = sortedValues.reduce((sum, value) => sum + value, 0) / sortedValues.length;

  return {
    count: sortedValues.length,
    min: sortedValues[0],
    q1,
    median,
    q3,
    max: sortedValues[sortedValues.length - 1],
    mean,
    lowerWhisker,
    upperWhisker,
    outliers,
  };
}

function hashValue(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

export function pointJitter(sample: string, response: ResponseGroup): number {
  const hash = hashValue(`${sample}:${response}`);
  return ((hash % 1000) / 999 - 0.5) * 0.34;
}

export function buildStep3Series(records: RawRecord[], cellType: CellType): BoxPlotSeries {
  const filteredRecords = records.filter(
    (record) =>
      record.condition === 'melanoma' &&
      record.sample_type === 'PBMC' &&
      record.treatment === 'miraclib',
  );

  const points = filteredRecords.map((record) => {
    const totalCount = CELL_TYPES.reduce((sum, key) => sum + record[key], 0);

    return {
      sample: record.sample,
      response: record.response,
      percentage: (record[cellType] / totalCount) * 100,
      population: record[cellType],
      totalCount,
    };
  });

  const noValues = points.filter((point) => point.response === 'no').map((point) => point.percentage);
  const yesValues = points.filter((point) => point.response === 'yes').map((point) => point.percentage);
  const stats = {
    no: summarize(noValues),
    yes: summarize(yesValues),
  };
  const maxValue = Math.max(
    0,
    ...points.map((point) => point.percentage),
    stats.no.max,
    stats.yes.max,
  );

  return {
    cellType,
    points,
    stats,
    domainMax: Math.max(20, Math.ceil(maxValue / 5) * 5 + 5),
  };
}
