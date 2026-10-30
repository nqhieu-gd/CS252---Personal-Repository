* **Bar charts** compare quantities corresponding to different groups or categories.
  Ex: `sns.barplot(x=df.index, y=df['Column_Name'])`
      * `x` determines what is on the horizontal axis (categories), and `y` determines the height of the bars.
      * Note: You must select the indexing column via `df.index`, it is not possible to use `df['Index_Name']` if that column was set as the index during `pd.read_csv()`.
* **Heatmaps** visualize patterns in tables of numbers using color-coding.
  Ex: `sns.heatmap(data=df, annot=True)`
      * `data=df` tells the notebook to color-code all cells in the DataFrame `df`.
      * `annot=True` ensures that the numeric values for each cell appear on the chart (leaving this out hides the numbers).