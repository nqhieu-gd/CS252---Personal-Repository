# Bar chart showing average score for racing games by platform
plt.figure(figsize=(8, 6))
sns.barplot(x=ign_data['Racing'], y=ign_data.index)
plt.xlabel("")
plt.title("Average Score for Racing Games, by Platform") # Your code here

# Check your answer
step_3.a.check()