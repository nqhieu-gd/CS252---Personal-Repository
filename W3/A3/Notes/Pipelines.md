* **Pipelines** are a simple way to keep your data preprocessing and modeling code organized, bundling preprocessing and modeling steps so you can use the whole bundle as if it were a single step.
* Benefits of Pipelines: Cleaner code, fewer bugs (harder to forget a preprocessing step), easier to productionize, and provides more options for model validation (like cross-validation).
* Steps to build a pipeline:
  + **Step 1: Define Preprocessing Steps**: Use `ColumnTransformer` to bundle different preprocessing for numerical data (e.g., `SimpleImputer`) and categorical data (e.g., `Pipeline` with `SimpleImputer` and `OneHotEncoder`).
    Ex: `preprocessor = ColumnTransformer(transformers=[('num', numerical_transformer, numerical_cols), ('cat', categorical_transformer, categorical_cols)])`
  + **Step 2: Define the Model**: E.g., `model = RandomForestRegressor(n_estimators=100, random_state=0)`
  + **Step 3: Create and Evaluate the Pipeline**: Use `Pipeline` class to bundle the preprocessor and the model.
    Ex: `my_pipeline = Pipeline(steps=[('preprocessor', preprocessor), ('model', model)])`
    * Calling `my_pipeline.fit(X_train, y_train)` preprocesses the training data and fits the model.
    * Calling `my_pipeline.predict(X_valid)` preprocesses the validation data and generates predictions.