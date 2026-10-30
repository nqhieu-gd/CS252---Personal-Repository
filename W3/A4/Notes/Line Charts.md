* **Line charts** are best suited for showing trends over a period of time.
* `sns.lineplot(data=df)` plots every column in the DataFrame as a separate line on the chart.
* To plot a single specific column:
  Ex: `sns.lineplot(data=df['Column_Name'], label="Label_Name")`
      * The `label` argument is used to specify how the line appears in the legend.
* Customization with `matplotlib.pyplot` (`plt`):
  + `plt.figure(figsize=(width, height))`: Sets the size of the figure (must be called *before* the `sns` plot command).
  + `plt.title("Chart Title")`: Adds a title to the chart.
  + `plt.xlabel("X-Axis Label")`: Modifies the label on the horizontal axis.