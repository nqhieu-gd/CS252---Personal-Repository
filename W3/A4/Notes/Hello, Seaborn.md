* **Seaborn** is a powerful data visualization library in Python built on top of `matplotlib`.
* Standard setup for plotting:
  Ex: `import pandas as pd`
      `import matplotlib.pyplot as plt`
      `import seaborn as sns`
* To load a dataset in a way that works cleanly with dates on the horizontal axis:
  Ex: `data = pd.read_csv(filepath, index_col="Date", parse_dates=True)`
      * `index_col="Date"` uses the "Date" column as the row labels.
      * `parse_dates=True` tells pandas to understand the row labels as dates instead of plain text.
* To quickly plot a line chart of the entire DataFrame:
  Ex: `plt.figure(figsize=(16,6))` (sets the width and height of the figure in inches)
      `sns.lineplot(data=data)`