bargain_wine = reviews.loc[(reviews.points / reviews.price).idxmax(), 'title']

# Check your answer
q5.check()