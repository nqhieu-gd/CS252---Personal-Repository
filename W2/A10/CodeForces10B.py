def Cinema():
    info = input().split()
    input_data = input().split()
    n = int(info[0])
    k = int(info[1])
    requests = [int(x) for x in input_data[:n]]
    occupied = [[False] * (k + 1) for _ in range(k + 1)]
    center = (k + 1) // 2
    col_pref = [0] * (k + 1)
    for c in range(1, k + 1):
        col_pref[c] = col_pref[c - 1] + abs(c - center)
    out = []
    for m in requests:
        best_cost = float("inf")
        best_row = -1
        best_l = -1

        for r in range(1, k + 1):
            row_dist = abs(r - center)
            free_count = 0
            for c in range(1, k + 1):
                if not occupied[r][c]:
                    free_count += 1
                else:
                    free_count = 0
                if free_count >= m:
                    l = c - m + 1
                    cost = m * row_dist + (col_pref[c] - col_pref[l - 1])
                    if cost < best_cost:
                        best_cost = cost
                        best_row = r
                        best_l = l

        if best_row != -1:
            r_end = best_l + m - 1
            for c in range(best_l, r_end + 1):
                occupied[best_row][c] = True
            out.append(f"{best_row} {best_l} {r_end}")
        else:
            out.append("-1")
    print("\n".join(out))


if __name__ == "__main__":
    Cinema()