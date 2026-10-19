def President_Office():
    col, row, color = input().split()
    col = int(col)
    row = int(row)
    last_input = ""
    deputy = ['.']
    for i in range(1, col + 1):
        s = input()
        for j in range(1, row + 1):
            if (s[j - 1] == color):
                if (i > 1 and (last_input != "" and last_input[j - 1] != color and last_input[j - 1] not in deputy)):
                    deputy.append(last_input[j - 1])
                if (j > 1 and (s[j - 2] != color and s[j - 2] not in deputy)):
                    deputy.append(s[j - 2])
            else:
                if (i > 1 and (last_input != "" and last_input[j - 1] == color and s[j - 1] not in deputy)):
                    deputy.append(s[j - 1])
                if (j > 1 and (s[j - 2] == color and s[j - 1] not in deputy)):
                    deputy.append(s[j - 1])
        last_input = s
    print(len(deputy) - 1)
    
if __name__ == "__main__":
    President_Office()