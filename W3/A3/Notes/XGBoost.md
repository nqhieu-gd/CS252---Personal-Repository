* **Gradient boosting** is a method that goes through cycles to iteratively add models into an **ensemble** (which combines predictions of several models).
* Unlike Random Forests (which build independent trees and average them), Gradient Boosting initializes with a single naive model, calculates errors (loss), trains a new decision tree to predict those errors, adds the new tree to the ensemble, and repeats.
* **XGBoost** (Extreme Gradient Boosting) is an implementation of gradient boosting designed for speed and performance, dominating many Kaggle competitions for tabular/structured data.
  Ex: `from xgboost import XGBRegressor` -> `my_model = XGBRegressor()` -> `my_model.fit(X_train, y_train)`
* Key parameters for tuning XGBoost:
  + `n_estimators`: How many times to go through the modeling cycle (equals the number of models in the ensemble). Too low = underfitting; too high = overfitting. Typical values: 100–1000.
  + `early_stopping_rounds`: Automatically finds the ideal `n_estimators` by stopping when the validation score stops improving (e.g., `early_stopping_rounds=5` stops after 5 straight rounds of deteriorating validation scores). Requires passing `eval_set=[(X_valid, y_valid)]` inside `.fit()`.
  + `learning_rate`: Multiply the predictions from each model by a small number before adding them in. A small learning rate (e.g., `0.05`) and a large `n_estimators` usually yields more accurate models.
  + `n_jobs`: For larger datasets, you can use parallelism to build models faster (usually set equal to the number of cores on your machine, e.g., `n_jobs=4`).