# Heatmap showing average game score by platform and genre
plt.figure(figsize=(10,10))
sns.heatmap(ign_data, annot=True)
plt.xlabel("Genre")
plt.title("Average Game Score, by Platform and Genre") # Your code here

# Check your answer
step_4.a.check()