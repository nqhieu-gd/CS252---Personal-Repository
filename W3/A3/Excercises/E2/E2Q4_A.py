# Preprocessed training and validation features
fin_imputer = SimpleImputer(strategy='median')
final_X_train = pd.DataFrame(fin_imputer.fit_transform(X_train))
final_X_valid = pd.DataFrame(fin_imputer.transform(X_valid))
final_X_train.columns = X_train.columns
final_X_valid.columns = X_valid.columns

# Check your answers
step_4.a.check()