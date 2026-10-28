# Import the train_test_split function and uncomment
# from _ import _

from sklearn.model_selection import train_test_split as tts

# fill in and uncomment
# train_X, val_X, train_y, val_y = ____
train_X, val_X, train_y, val_y = tts(X, y, random_state = 1)

# Check your answer
step_1.check()