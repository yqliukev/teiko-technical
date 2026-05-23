import analysis
import matplotlib.pyplot as plt
from scipy import stats
import json

CELL_TYPES = ['b_cell', 'cd8_t_cell', 'cd4_t_cell', 'nk_cell', 'monocyte']

STEP_1 = True
STEP_2 = True
STEP_3 = True
STEP_4 = True
QUESTION = True

if __name__ == "__main__":
    if STEP_1:
        print("STEP 1: Fetching data from database")
        import load_data

    if STEP_2:
        print("\nSTEP 2: Summarizing cell counts")
        df = analysis.fetch_columns(columns = ['sample'] + CELL_TYPES)
        summary_df = analysis.summarize_cells(df)
        summary_df.to_csv('cell_count_summary.csv', index=False)
    
    if STEP_3:
        print("\nSTEP 3: Visualizing treatment response")
        df = analysis.fetch_columns(
            options="WHERE condition = 'melanoma' AND sample_type = 'PBMC' AND treatment = 'miraclib'"
        )
        ## visualization
        summary, fig = analysis.treatment_boxplot(df)
        plt.savefig('treatment_response_boxplot.png')
        ## statistical tests
        stat_test_results = {}
        for cell_type in CELL_TYPES:
            positive_data = summary[(summary['cell_type'] == cell_type) & (summary['response'] == 'yes')]['percentage']
            negative_data = summary[(summary['cell_type'] == cell_type) & (summary['response'] == 'no')]['percentage']
            ttest_t, ttest_p = stats.ttest_ind(positive_data, negative_data, equal_var=False)
            mw_t, mw_p = stats.mannwhitneyu(positive_data, negative_data, alternative='two-sided')
            stat_test_results[cell_type] = {'ttest_p': round(ttest_p, 4), 'mw_p': round(mw_p, 4)}
            with open('stat_test_results.json', 'w') as f:
                json.dump(stat_test_results, f, indent=4)

    if STEP_4:
        print("\nSTEP 4: Data Subsetting Analysis")
        df = analysis.fetch_columns(
            columns=['sample', 'project', 'response', 'sex'],
            options="WHERE condition = 'melanoma' AND sample_type = 'PBMC' AND time_from_treatment_start = 0"
        )
        with open('step_4_summary.json', 'w') as f:
            json.dump({
                'project_counts': df.groupby(['project']).count()['sample'].to_dict(),
                'response_counts': df.groupby(['response']).count()['sample'].to_dict(),
                'sex_counts': df.groupby(['sex']).count()['sample'].to_dict()
            }, f, indent=4)
        print(df.groupby(['project']).count()['sample'])
        print(df.groupby(['response']).count()['sample'])
        print(df.groupby(['sex']).count()['sample'])

    if QUESTION:
        print("\n QUESTION RESPONSE")
        df = analysis.fetch_columns(
            columns=['sample', 'b_cell'],
            options="WHERE condition = 'melanoma' AND sex = 'M' AND response = 'yes' AND time_from_treatment_start = 0"
        )
        print(f"{df['b_cell'].mean():.2f}")
