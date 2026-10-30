# Path of the files to read
cancer_filepath = "../input/cancer.csv"

# Fill in the line below to read the file into a variable cancer_data
cancer_data = pd.read_csv(cancer_filepath, index_col='Id')

# Run the line below with no changes to check that you've loaded the data correctly
step_1.check()