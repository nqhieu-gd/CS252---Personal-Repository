# from _ import _
#specify the model. 
#For model reproducibility, set a numeric value for random_state when specifying the model
from sklearn.tree import DecisionTreeRegressor

iowa_model = DecisionTreeRegressor(random_state=18)

# Fit the model
iowa_model.fit(X, y)

# Check your answer
step_3.check()