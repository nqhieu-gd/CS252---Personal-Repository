* The data type for a column in a DataFrame or a Series is known as the **dtype**.
* `data.col_name.dtype` returns the data type of a specific column; `data.dtypes` returns the dtype of every column.
* Strings do not have their own dtype in pandas; instead, they are given the `object` type.
* `data.col_name.astype('type_name')` converts a column of one type into another (e.g., `'float64'` or `'str'`).
* Entries missing values are given the value `NaN` ("Not a Number"), which is always of the `float64` dtype.
* `pd.isnull(data.col_name)` (or `pd.notnull()`) selects missing (or non-missing) entries:
  Ex: `data[pd.isnull(data.col_name)]`
* `data.col_name.fillna("Unknown")` replaces missing `NaN` values with `"Unknown"`.
* `data.col_name.replace("old_val", "new_val")` replaces non-null values in a dataset.