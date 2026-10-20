import sys


def solve():
    moves = sys.stdin.read().strip()
    if not moves:
        return

    dirs = {"L": (-1, 0), "R": (1, 0), "U": (0, 1), "D": (0, -1)}

    visited = {(0, 0)}
    curr = (0, 0)

    for move in moves:
        dx, dy = dirs[move]
        nxt = (curr[0] + dx, curr[1] + dy)

        if nxt in visited:
            print("BUG")
            return

        for mx, my in dirs.values():
            neighbor = (nxt[0] + mx, nxt[1] + my)
            if neighbor != curr and neighbor in visited:
                print("BUG")
                return

        visited.add(nxt)
        curr = nxt

    print("OK")


if __name__ == "__main__":
    solve()