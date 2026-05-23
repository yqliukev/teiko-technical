import sqlite3
from typing import Iterable

import pandas as pd
import matplotlib.pyplot as plt

DB_PATH = "teiko.db"
TABLE_NAME = "cell_count"

def fetch_columns(
	db_path: str = DB_PATH,
	table_name: str = TABLE_NAME,
    columns: Iterable[str] = (),
    options: str = ""
) -> pd.DataFrame:

    if columns:
        query = f"SELECT {', '.join(columns)} FROM {table_name} {options}"
    else:
        query = f"SELECT * FROM {table_name} {options}"

    with sqlite3.connect(db_path) as connection:
	    return pd.read_sql_query(query, connection)

### STEP 2
def summarize_cells(data: pd.DataFrame,
                    cell_types: list[str] = ['b_cell', 'cd8_t_cell', 'cd4_t_cell', 'nk_cell', 'monocyte']
                    ) -> pd.DataFrame:
    df = data.copy()
    df['total_count'] = df[cell_types].sum(axis=1)
    result = df.melt(
        id_vars=df.columns.difference(cell_types),
		value_vars=cell_types,
		var_name='cell_type',
		value_name='population',
	)
    result['percentage'] = result['population'] / result['total_count'] * 100
    return result.sort_values(by=['sample'])


### STEP 3
def treatment_boxplot(data: pd.DataFrame,
                            condition: str = "melanoma",
                            treatment: str = "miraclib",
                            sample_type: str = "PBMC",
                            cell_types: list[str] = ['b_cell', 'cd8_t_cell', 'cd4_t_cell', 'nk_cell', 'monocyte']
                            ) -> tuple[pd.DataFrame, plt.Figure]:
    filtered = data[
        (data['condition'] == condition)
        & (data['sample_type'] == sample_type)
        & (data['treatment'] == treatment)
    ].copy()
    summary = summarize_cells(filtered)

    fig, axes = plt.subplots(1, len(cell_types), figsize=(18, 5), sharey=True)

    for axis, cell_type in zip(axes, cell_types):
        cell_data = summary[summary['cell_type'] == cell_type]
        boxes = axis.boxplot(
            [cell_data[cell_data['response'] == 'no']['percentage'], cell_data[cell_data['response'] == 'yes']['percentage']],
            widths=0.6,
            patch_artist=True,
        )

        for patch, color in zip(boxes['boxes'], ['#5B7FFF', '#16F921']):
            patch.set_facecolor(color)
            patch.set_alpha(0.8)

        axis.set_title(cell_type.replace('_', ' ').title())
        axis.set_xticklabels(['No', 'Yes'])
        axis.set_xlabel('Response')
        axis.grid(axis='y', alpha=0.2)

    axes[0].set_ylabel('Cell percentage')

    return summary, fig


if __name__ == "__main__":
    pass