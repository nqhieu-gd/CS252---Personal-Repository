def Bus_Stop():
    n, vb, vs = map(int, input().split())
    bs = list(map(int, input().split()))
    coord = list(map(int, input().split()))
    min_dis = float('inf')
    min_time = float('inf')
    best_stop = 2
    for i in range(1, n):
        tim = ((bs[i] - coord[0])**2 + coord[1]**2)**0.5 / vs + bs[i] / vb
        dis = ((bs[i] - coord[0])**2 + coord[1]**2)**0.5
        if tim < min_time:
            min_time = tim
            min_dis = dis
            best_stop = i + 1
        elif abs(tim - min_time) < 1e-9:
            if dis < min_dis:
                min_dis = dis
                best_stop = i + 1
        if bs[i] >= coord[0]:
            break
    print(best_stop)
        
if __name__ == "__main__":
    Bus_Stop()