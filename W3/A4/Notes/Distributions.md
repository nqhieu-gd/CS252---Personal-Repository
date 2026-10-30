* **Histograms** show the distribution of a single numerical variable by dividing values into intervals ("bins") and counting how many observations fall into each bin.
  Ex: `sns.histplot(df['Column_Name'])`
* **Kernel Density Estimate (KDE) plots** can be thought of as a smoothed histogram.
  Ex: `sns.kdeplot(data=df['Column_Name'], shade=True)`
      * `shade=True` (or `fill=True` in newer versions) colors the area below the curve.
* **2D KDE plots** create a two-dimensional smoothed distribution using color-coding to show how likely we are to see combinations of two variables:
  Ex: `sns.jointplot(x=df['Col_1'], y=df['Col_2'], kind="kde")`
      * This also displays the individual 1D KDE curves for each variable along the top and right margins of the plot.
* **Color-coded distributions**: You can break a histogram or KDE plot down by category in a single command using the `hue` parameter:
  Ex: `sns.histplot(data=df, x='Numeric_Col', hue='Category_Col')`
  Ex: `sns.kdeplot(data=df, x='Numeric_Col', hue='Category_Col', shade=True)`