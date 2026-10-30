price_extremes = reviews.groupby('variety').price.agg([min, max])

# Check your answer
q3.check()