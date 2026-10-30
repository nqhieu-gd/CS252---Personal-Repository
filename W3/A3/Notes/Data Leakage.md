* **Data leakage** (or **leakage**) happens when your training data contains information about the target, but similar data will not be available when the model is used for prediction in the real world.
* It leads to high performance on the training set (and even validation data), but the model performs very poorly in production.
* There are two main types of leakage:
  + **1. Target Leakage**: Occurs when your predictors include data that will not be available at the time you make predictions.
    * Think about target leakage in terms of *timing or chronological order* (any variable updated or created *after* the target value is realized should be excluded).
    * Ex: Including `took_antibiotic_medicine` to predict whether a patient gets `pneumonia`. People take antibiotics *after* getting pneumonia, so it is target leakage.
  + **2. Train-Test Contamination**: Occurs when you aren't careful to distinguish training data from validation data (e.g., running preprocessing like fitting an imputer before calling `train_test_split()`).
    * Using scikit-learn **Pipelines** (even with cross-validation) is the best safeguard against train-test contamination.