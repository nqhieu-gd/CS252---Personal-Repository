# Fill in the line below: get names of columns with missing values
missing = [col for col in X_train.columns
                     if X_train[col].isnull().any()]
 # Your code here

# Fill in the lines below: drop columns in training and validation data
reduced_X_train = X_train.drop(missing, axis=1)
reduced_X_valid = X_valid.drop(missing, axis=1)

# Check your answers
step_2.check()