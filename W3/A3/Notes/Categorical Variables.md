* A **categorical variable** takes only a limited number of values (often text/non-numeric, like "Never", "Rarely", "Every day").
* You can find categorical variables in a DataFrame by checking if the data type (`dtype`) is `'object'`.
* There are 3 approaches to preparing categorical data for machine learning:
  + **1. Drop Categorical Variables**: Easiest approach (`data.select_dtypes(exclude=['object'])`), but only works well if the columns did not contain useful information.
  + **2. Ordinal Encoding**: Assigns each unique value to a different integer (e.g., Never -> 0, Rarely -> 1, Most days -> 2). This assumes an ordering of the categories (**ordinal variables**).
    Ex: `from sklearn.preprocessing import OrdinalEncoder` -> `ordinal_encoder.fit_transform(X_train[object_cols])`
  + **3. One-Hot Encoding**: Creates new columns indicating the presence (1) or absence (0) of each possible value in the original data. It does not assume an ordering (**nominal variables**).
    * Does not work well if the categorical variable takes on a large number of values (generally > 15 different values, i.e., high **cardinality**).
    Ex: `from sklearn.preprocessing import OneHotEncoder` -> `OH_encoder = OneHotEncoder(handle_unknown='ignore', sparse=False)`