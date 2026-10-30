* `data.groupby('col_name')` groups data into subsets that share the same value in `col_name`.
* `value_counts()` is just a shortcut for `data.groupby('col_name').col_name.count()`.
* You can apply summary functions to each group, e.g., `data.groupby('col_1').col_2.min()`.
* `data.groupby('col_1').apply(lambda df: F(df))` accesses each group as a DataFrame slice and applies custom function `F(df)`.
* Grouping by multiple columns (`data.groupby(['col_1', 'col_2'])`) results in a **MultiIndex** (multiple tiers of labels).
* `data.reset_index()` converts a MultiIndex back into a regular index.
* `data.sort_values(by='col_name')` sorts rows by value in ascending order by default.
* Pass `ascending=False` to sort in descending order (higher numbers first).
* `data.sort_values(by=['col_1', 'col_2'])` sorts by more than one column at a time.
* `data.sort_index()` sorts by the index values instead of column values.