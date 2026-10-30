# Fill in the line below: preprocess test data
final_X_test = pd.DataFrame(fin_imputer.transform(X_test))

# Fill in the line below: get test predictions
preds_test = model.predict(final_X_test)

# Check your answers
step_4.b.check()