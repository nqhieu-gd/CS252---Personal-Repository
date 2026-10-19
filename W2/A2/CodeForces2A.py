def Winner():
    n = int(input())
    rounds = []
    final_scores = {}

    for i in range(1, n + 1):
        name, score_str = map(str, input().split())
        score = int(score_str)
        rounds.append((name, score))
        final_scores[name] = final_scores.get(name, 0) + score

    max_score = max(final_scores.values())

    curr_scores = {}
    for name, score in rounds:
        curr_scores[name] = curr_scores.get(name, 0) + score
        if curr_scores[name] >= max_score and final_scores[name] == max_score:
            print(name)
            return


if __name__ == "__main__":
    Winner()