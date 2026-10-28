from sklearn.metrics import mean_absolute_error as mae
val_mae = mae(val_y, val_predictions)

# uncomment following line to see the validation_mae
print(val_mae)

# Check your answer
step_4.check()