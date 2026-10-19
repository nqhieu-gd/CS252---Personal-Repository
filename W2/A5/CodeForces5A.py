def Chat_Sv():
    count = 0
    traffic = 0
    while True:
        try:
            n = input()
            if not n:
                continue
            elif n[0] == '+':
                count += 1
            elif n[0] == '-':
                count -= 1
            else:
                lc = n.find(':')
                traffic += len(n[lc + 1:])*count
        except EOFError:
            break
    print(traffic)
        
if __name__ == "__main__":
    Chat_Sv()