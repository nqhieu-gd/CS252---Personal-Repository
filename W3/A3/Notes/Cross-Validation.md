* In **cross-validation**, we run our modeling process on different subsets of the data to get multiple measures of model quality.
* We divide the data into $k$ **folds** (e.g., 5 folds, each 20% of the full dataset). We hold out Fold 1 as validation and train on Folds 2-5, then repeat for every fold so 100% of the data is used as validation at some point.
* Cross-validation gives a more accurate measure of model quality, though it takes longer to run.
* When to use each validation method:
  + **Small datasets**: Run **cross-validation** (extra computational burden isn't a big deal, and you shouldn't waste data on a single validation split).
  + **Large datasets**: A **single validation set** is sufficient (code runs faster, and you have enough data that there's little need to reuse some of it for holdout).
* Code example:
  Ex: `from sklearn.model_selection import cross_val_score`
      `scores = -1 * cross_val_score(my_pipeline, X, y, cv=5, scoring='neg_mean_absolute_error')`
      `scores.mean()` gives the average MAE across all folds.