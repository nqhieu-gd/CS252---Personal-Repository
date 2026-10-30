mean = reviews.price.mean()
centered_price = reviews.price.map(lambda p: p - mean)

# Check your answer
q4.check()