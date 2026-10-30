best_rating_per_price = reviews.groupby('price')['points'].max().sort_index()

# Check your answer
q2.check()