* Most machine learning libraries (including scikit-learn) give an error if you try to build a model using data with missing values (`NaN`).
* There are 3 main approaches to dealing with missing values:
  + **1. Drop Columns**: Remove columns with missing values using `data.drop(cols_with_missing, axis=1)`. Only good if most values in the column are missing, otherwise you lose useful info.
  + **2. Imputation**: Fill in missing values with some number (e.g., the mean value along each column). It usually leads to more accurate models than dropping the column entirely.
    Ex: `from sklearn.impute import SimpleImputer` -> `my_imputer = SimpleImputer()` -> `imputed_X_train = pd.DataFrame(my_imputer.fit_transform(X_train))` -> `imputed_X_valid = pd.DataFrame(my_imputer.transform(X_valid))`
  + **3. An Extension to Imputation**: Impute the missing values, while also keeping track of which values were imputed by creating a new column (`col_name_was_missing`) with True/False.
* Note: Imputation removes column names, so you must put them back: `imputed_X_train.columns = X_train.columns`.