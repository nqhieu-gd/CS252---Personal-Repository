# Fill in argument to make optimal size and uncomment
final_model = DecisionTreeRegressor(max_leaf_nodes=best_tree_size, random_state=18)

# fit the final model and uncomment the next two lines
final_model.fit(X, y)

# Check your answer
step_2.check()