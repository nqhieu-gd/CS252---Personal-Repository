def Theatre():
    n, m, a, *_ = map(int, input().split())

    rows = (n + a - 1) // a
    cols = (m + a - 1) // a

    print(rows * cols)


if __name__ == "__main__":
    Theatre()