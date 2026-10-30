# Line plot showing the number of visitors to Avila Adobe over time
plt.figure(figsize=(12,6))
plt.title("Monthly Visitors to Avila Adobe")
sns.lineplot(data=museum_data['Avila Adobe'])
plt.xlabel("Date") # Your code here

# Check your answer
step_4.a.check()