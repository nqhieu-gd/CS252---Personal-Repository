* Model validation is to evaluate the model's accuracy. Higher accuracy = more likely to happen.
* A common mistake: make prediction from **training data** and compare to data in **training data**, such evaluation yields "In-Sample" Scores.
* For example, all data of property X comes with property Y, the model claims that X -> Y, although in reality X and Y are not related, by evaluating using old data, the model yields correct answer though it's wrong.
* We test the model using real data it has never seen before, it is called **validation data**.
* For comprehension, we need to summarize a model quality into a single metric. There are many such metrics.
* **Mean Absolute Error** (**MAE**) is one among those metrics:

&#x20;   + error = Actual\_Value - Predicted\_Value

&#x20;   + We take the absolute of those errors.

&#x20;   + The average of those results are our measure of model quality.

