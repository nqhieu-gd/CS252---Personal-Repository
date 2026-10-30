# Path of the file to read
candy_filepath = "../input/candy.csv"

# Fill in the line below to read the file into a variable candy_data
candy_data = pd.read_csv(candy_filepath, index_col='id')

# Run the line below with no changes to check that you've loaded the data correctly
step_1.check()