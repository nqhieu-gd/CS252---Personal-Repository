* If the dataset is too big, it needs to be simplified for general purposes.
* To view the column set of the dataset, use **columns** property.

  Ex: File\_Name.columns

* To drop missing values inside a table/dataset, use **dropna** (drop not available).

  Ex: File\_Name.dropna(axis=X)

* There are many ways to select a subject of data.

  * Dot notation (select the prediction target): Choose a column as the prediction target, called y.

  Ex: y = File\_Name.Chosen\_Col\_Name

  * Selecting with a column list (choose "features"): The inputted columns are called features, called X.

  Ex: F_List = \[Feature\_1, Feature\_2, Feature\_3, ...]
      X = File\_Name.\[F_List]



\---

* Scikit-learn is popular for modeling data typically stored in DataFrames, written as **sklearn**.
* Steps to build a model:

  * Define: type and other parameters of the model
  * Fit: Data -> Pattern (Most important of modeling)
  * Predict: From fitted data
  * Evaluate: Accuracy of the model
* Many models allow randomness in training.

