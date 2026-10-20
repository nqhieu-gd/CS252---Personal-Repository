def Memory():
    t, m = map(int, input().split())
    memory = [0] * m
    next_id = 1

    for i in range(t):
        msg = input().split()
        cmd = msg[0]

        if cmd == "alloc":
            n = int(msg[1])
            did_alloc = False
            for j  in range(m + 1 - n):
                if all(memory[l] == 0 for l in range(j, j + n)):
                    for k in range(j, j + n):
                        memory[k] = next_id
                    did_alloc = True
                    print(next_id)
                    next_id += 1
                    break
            if not did_alloc:
                print("NULL")

        elif cmd == "erase":
            x = int(msg[1])
            if x >= next_id or x <= 0 or x not in memory:
                print("ILLEGAL_ERASE_ARGUMENT")
            else:
                for j in range(m):
                    if memory[j] == x:
                        memory[j] = 0

        elif cmd == "defragment":
            non_zero = [val for val in memory if val != 0]
            memory = non_zero + [0] * (m - len(non_zero))


if __name__ == "__main__":
    Memory()