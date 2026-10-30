* `data.rename(columns={'old_name': 'new_name'})` changes column names.
* `data.rename(index={0: 'firstEntry', 1: 'secondEntry'})` changes index values.
* `data.rename_axis("row_axis_name", axis='rows').rename_axis("col_axis_name", axis='columns')` gives names to the row and column indices themselves.
* There are 3 methods for combining different DataFrames/Series (in order of increasing complexity):
  * `pd.concat([df_1, df_2])`: Smushes elements together along an axis. Useful when different DataFrames have the exact same fields/columns.
  * `df_1.join(df_2, lsuffix='_left', rsuffix='_right')`: Combines different DataFrame objects which have an index in common. (`lsuffix` and `rsuffix` are necessary if both tables share column names).
  * `merge()`: Can do anything `join()` can do, so it is generally unneeded if you can just `set_index()` and use `join()`.