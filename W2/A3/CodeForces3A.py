def King_Path():
    KL = str(input())
    TL = str(input())
    a = abs(ord(KL[0]) - ord(TL[0]))
    b = abs(ord(KL[1]) - ord(TL[1]))
    print(a if a > b else b)
    while KL != TL:
        str1 = ""
        if (KL[0] > TL[0]):
            KL = chr(ord(KL[0]) - 1) + KL[1]
            str1 += "L"
        elif (KL[0] < TL[0]):
            KL = chr(ord(KL[0]) + 1) + KL[1]
            str1 += "R"
        if (KL[1] > TL[1]):
            KL = KL[0]+ chr(ord(KL[1]) - 1)
            str1 += "D"
        elif (KL[1] < TL[1]):
            KL = KL[0] + chr(ord(KL[1]) + 1)
            str1 += "U"
        print(str1)
            
if __name__ == "__main__":
    King_Path()