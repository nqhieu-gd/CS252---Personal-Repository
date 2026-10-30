* **Choosing the right plot type** (3 main categories):

  * **Trends**: A trend is defined as a pattern of change.

    * `sns.lineplot`: Best for showing trends over a period of time.

  * **Relationships**: Used to understand the way that variables in data interact with one another.

    * `sns.barplot`: Useful for comparing quantities corresponding to different groups.

    * `sns.heatmap`: Useful for finding color-coded patterns in tables of numbers.

    * `sns.scatterplot`: Shows the relationship between two continuous variables; if color-coded (`hue`), also shows the relationship with a third categorical variable.

    * `sns.regplot`: Includes a regression line in the scatter plot.

    * `sns.lmplot`: Useful for drawing multiple regression lines if the scatter plot contains multiple color-coded groups.

    * `sns.swarmplot`: Shows the relationship between a continuous variable and a categorical variable.

  * **Distributions**: Visualize the possible values that we can expect to see in a variable, along with how likely they are.

    * `sns.histplot`: Shows the distribution of a single numerical variable (or multiple by group).

    * `sns.kdeplot`: Shows a smoothed histogram (1D) or 2D density contour.

    * `sns.jointplot`: Simultaneously displays a 2D KDE plot with the individual 1D KDE plots for each variable.

* **Changing styles** with Seaborn:

  * You can quickly change the figure theme with `sns.set_style("style_name")`.

  * The 5 available Seaborn themes are: `"darkgrid"`, `"whitegrid"`, `"dark"`, `"white"`, and `"ticks"`.