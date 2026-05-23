import sqlite3
import csv

FILE_PATH = 'cell-count.csv'
DB_PATH = 'teiko.db'

SUBJECT_COLUMNS = (
    ('project', 'INTEGER NOT NULL'),
    ('subject', 'INTEGER PRIMARY KEY NOT NULL'),
    ('condition', 'TEXT NOT NULL'),
    ('age', 'INTEGER NOT NULL'),
    ('sex', 'TEXT NOT NULL CHECK (sex IN ("M", "F"))'),
    ('treatment', 'TEXT NOT NULL'),
    ('response', 'TEXT CHECK ((response IN ("yes", "no")) OR (response = "" AND treatment = "none"))'),
)

SAMPLE_COLUMNS = (
    ('sample', 'INTEGER PRIMARY KEY NOT NULL'),
    ('subject', 'INTEGER NOT NULL REFERENCES subjects(subject)'),
    ('sample_type', 'TEXT NOT NULL'),
    ('time_from_treatment_start', 'INTEGER NOT NULL'),
    ('b_cell', 'INTEGER NOT NULL'),
    ('cd8_t_cell', 'INTEGER NOT NULL'),
    ('cd4_t_cell', 'INTEGER NOT NULL'),
    ('nk_cell', 'INTEGER NOT NULL'),
    ('monocyte', 'INTEGER NOT NULL'),
)

def transform_row(row):
    return {
        **row,
        'project': int(row['project'][3:]),
        'subject': int(row['subject'][3:]),
        'sample': int(row['sample'][6:]),
    }

### DB setup
con = sqlite3.connect(DB_PATH)
cur = con.cursor()
cur.execute("DROP TABLE IF EXISTS subjects")
cur.execute(f"""CREATE TABLE IF NOT EXISTS subjects (
            {', '.join(f'{name} {arg}' for name, arg in SUBJECT_COLUMNS)}
)""")
cur.execute("DROP TABLE IF EXISTS samples")
cur.execute(f"""CREATE TABLE IF NOT EXISTS samples (
            {', '.join(f'{name} {arg}' for name, arg in SAMPLE_COLUMNS)}
)""")

### Load data
with open (FILE_PATH, 'r') as file:
    dr = csv.DictReader(file)
    subject_rows = []
    sample_rows = []
    seen_subjects = set()

    for row in dr:
        row = transform_row(row)
        subject_id = row['subject']

        if subject_id not in seen_subjects:
            seen_subjects.add(subject_id)
            subject_rows.append(tuple(row[column_name] for column_name, _ in SUBJECT_COLUMNS))

        sample_rows.append(tuple(row[column_name] for column_name, _ in SAMPLE_COLUMNS))

    cur.executemany(
        f"INSERT INTO subjects ({', '.join(name for name, _ in SUBJECT_COLUMNS)}) VALUES ({', '.join('?' for _ in SUBJECT_COLUMNS)})",
        subject_rows,
    )
    cur.executemany(
        f"INSERT INTO samples ({', '.join(name for name, _ in SAMPLE_COLUMNS)}) VALUES ({', '.join('?' for _ in SAMPLE_COLUMNS)})",
        sample_rows,
    )
    con.commit()
    con.close()