* **Scatter plots** use the coordinate plane to show the relationship between two continuous variables.
  Ex: `sns.scatterplot(x=df['Col_1'], y=df['Col_2'])`
* To add a **regression line** (line of best fit) to double-check the strength of a linear relationship:
  Ex: `sns.regplot(x=df['Col_1'], y=df['Col_2'])`
* **Color-coded scatter plots** let you display the relationships between *three* variables by passing a third categorical variable to the `hue` parameter:
  Ex: `sns.scatterplot(x=df['Col_1'], y=df['Col_2'], hue=df['Category_Col'])`
* To plot **multiple regression lines** (one for each category in `hue`), use `sns.lmplot`:
  Ex: `sns.lmplot(x="Col_1", y="Col_2", hue="Category_Col", data=df)`
* **Categorical scatter plots** (or **swarm plots**) are used to feature a categorical variable on one of the main axes without overlapping points:
  Ex: `sns.swarmplot(x=df['Category_Col'], y=df['Continuous_Col'])`