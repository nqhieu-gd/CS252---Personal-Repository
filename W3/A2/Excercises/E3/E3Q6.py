tropical = reviews.description.map(lambda d: "tropical" in d).sum()
fruity = reviews.description.map(lambda d: "fruity" in d).sum()
descriptor_counts = pd.Series([tropical, fruity], index=['tropical', 'fruity'])

# Check your answer
q6.check()