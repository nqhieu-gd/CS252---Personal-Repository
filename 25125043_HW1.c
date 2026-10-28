#include <stdio.h>
#include <limits.h>

unsigned Prob_1(unsigned x, unsigned y) {
    return x & 0xFF | y & ~0xFF;
}

unsigned replace_byte(unsigned x, int i, unsigned char b) {
    return x & ~(0xFFu << (i << 3)) | (unsigned) b << (i << 3);
}

int Prob_3A(int x) {
    return !!x;
}

int Prob_3B(int x) {
    return !!(~x);
}

int Prob_3C(int x) {
    return !!(x & 0xFF);
}

int Prob_3D(int x) {
    return !!(~(x >> (sizeof(int) - 1 << 3) & 0xFF));
}

int any_odd_one(unsigned x) {
    return !!(x & 0xAAAAAAAAu);
}

int lower_one_mask(int n) {
    return ~0u >> ((sizeof(int) << 3) - n);
}

int saturating_add(int x, int y) {
    int sig_x = x >> ((sizeof(int) << 3) - 1);
    int sig_y = y >> ((sizeof(int) << 3) - 1);
    int sig_sum = (x + y) >> ((sizeof(int) << 3) - 1);
    int pos_overflow = ~(sig_x | sig_y) & (sig_x ^ sig_sum);
    int neg_overflow = (sig_x & sig_y) & (sig_x ^ sig_sum);
    int over = neg_overflow | pos_overflow;
    return ((x + y) & ~over) | (INT_MAX & pos_overflow) | (INT_MIN & neg_overflow);
}

int Prob_7A(int x) {
    return (x << 4) + x;
}

int Prob_7B(int x) {
    return x - (x << 3);
}

int Prob_7C(int x) {
    return (x << 6) - (x << 2);
}

int Prob_7D(int x) {
    return (x << 4) - (x << 7);
}

int mul3div4(int x) {
    int prod = (x << 1) + x;
    return (prod + (prod >> ((sizeof(int) << 3) - 1)&3)) >> 2;
}

int prob_9A(int k) {
    return (~0u << k);
}

int prob_9B(int k, int j) {
    return ((~0u << (k)) << j) ^ (~0u << j);
}

int leftmost_one(unsigned x) {
    x |= (x >> 1);
    x |= (x >> 2);
    x |= (x >> 4);
    x |= (x >> 8);
    x |= (x >> 16);
    return x ^ (x >> 1);
}

int odd_ones(unsigned x) {
    x ^= (x >> 16);
    x ^= (x >> 8);
    x ^= (x >> 4);
    x ^= (x >> 2);
    x ^= (x >> 1);
    return x & 1;
}

int main(void) {
    printf("=== Problem 1 ===\n");
    unsigned p1_x[] = {0x89ABCDEFU, 0x00000000U, 0xFFFFFFFFU, 0x12345678U};
    unsigned p1_y[] = {0x76543210U, 0xFFFFFFFFU, 0x00000000U, 0x9ABCDEF0U};
    for (int t = 0; t < 4; t++) {
        printf("Prob_1(0x%08X, 0x%08X) = 0x%08X\n",
               p1_x[t], p1_y[t], Prob_1(p1_x[t], p1_y[t]));
    }

    printf("\n=== Problem 2 (replace_byte) ===\n");
    unsigned p2_x[] = {0x12345678U, 0x12345678U, 0x12345678U, 0xFFFFFFFFU};
    int p2_i[]      = {2, 0, 3, 1};
    unsigned char p2_b[] = {0xAB, 0xAB, 0x00, 0x55};
    for (int t = 0; t < 4; t++) {
        printf("replace_byte(0x%08X, %d, 0x%02X) = 0x%08X\n",
               p2_x[t], p2_i[t], p2_b[t], replace_byte(p2_x[t], p2_i[t], p2_b[t]));
    }

    printf("\n=== Problem 3 (A, B, C, D) ===\n");
    int p3_x[] = {0x00000000, -1 /* 0xFFFFFFFF */, 0x12345600, (int)0xFF000000, (int)0xFEFFFFFF};
    for (int t = 0; t < 5; t++) {
        printf("x = 0x%08X -> 3A:%d, 3B:%d, 3C:%d, 3D:%d\n",
               (unsigned)p3_x[t], Prob_3A(p3_x[t]), Prob_3B(p3_x[t]),
               Prob_3C(p3_x[t]), Prob_3D(p3_x[t]));
    }

    printf("\n=== Problem 4 (any_odd_one) ===\n");
    unsigned p4_x[] = {0x55555555U, 0x00000002U, 0x80000000U, 0x00000000U, 0xFFFFFFFFU};
    for (int t = 0; t < 5; t++) {
        printf("any_odd_one(0x%08X) = %d\n", p4_x[t], any_odd_one(p4_x[t]));
    }

    printf("\n=== Problem 5 (lower_one_mask) ===\n");
    int p5_n[] = {1, 6, 17, 31, 32};
    for (int t = 0; t < 5; t++) {
        printf("lower_one_mask(%2d) = 0x%08X\n",
               p5_n[t], (unsigned)lower_one_mask(p5_n[t]));
    }

    printf("\n=== Problem 6 (saturating_add) ===\n");
    int p6_x[] = {INT_MAX, INT_MIN, 100, INT_MAX - 5, INT_MIN + 5};
    int p6_y[] = {1, -1, -30, 10, -10};
    for (int t = 0; t < 5; t++) {
        printf("saturating_add(%d, %d) = %d\n",
               p6_x[t], p6_y[t], saturating_add(p6_x[t], p6_y[t]));
    }

    printf("\n=== Problem 7 (Constant Multiplications) ===\n");
    int p7_x[] = {0, 1, -5, 100, INT_MAX};
    for (int t = 0; t < 5; t++) {
        int x = p7_x[t];
        printf("x = %d:\n", x);
        printf("  7A (17*x)   = %d (expected %d)\n", Prob_7A(x), (int)(17U * (unsigned)x));
        printf("  7B (-7*x)   = %d (expected %d)\n", Prob_7B(x), (int)(-7U * (unsigned)x));
        printf("  7C (60*x)   = %d (expected %d)\n", Prob_7C(x), (int)(60U * (unsigned)x));
        printf("  7D (-112*x) = %d (expected %d)\n", Prob_7D(x), (int)(-112U * (unsigned)x));
    }

    printf("\n=== Problem 8 (mul3div4) ===\n");
    int p8_x[] = {8, 5, -5, -1, 0x40000000, INT_MIN, INT_MAX};
    for (int t = 0; t < 7; t++) {
        int x = p8_x[t];
        int expected = (int)(3U * (unsigned)x) / 4;
        printf("mul3div4(%11d [0x%08X]) = %11d [0x%08X] (expected %11d)\n",
               x, (unsigned)x, mul3div4(x), (unsigned)mul3div4(x), expected);
    }

    printf("\n=== Problem 9 (Bit Patterns 9A and 9B) ===\n");
    int p9a_k[] = {0, 8, 16, 31};
    for (int t = 0; t < 4; t++) {
        printf("prob_9A(k=%2d) = 0x%08X\n", p9a_k[t], (unsigned)prob_9A(p9a_k[t]));
    }
    int p9b_k[] = {8, 0, 31, 28};
    int p9b_j[] = {4, 10, 0, 4}; /* Note: k=28, j=4 tests edge case j+k == w */
    for (int t = 0; t < 4; t++) {
        printf("prob_9B(k=%2d, j=%2d) = 0x%08X\n",
               p9b_k[t], p9b_j[t], (unsigned)prob_9B(p9b_k[t], p9b_j[t]));
    }

    printf("\n=== Problem 10 (leftmost_one) ===\n");
    unsigned p10_x[] = {0xFF00U, 0x6600U, 0x00000000U, 0x80000000U, 0x00000001U};
    for (int t = 0; t < 5; t++) {
        printf("leftmost_one(0x%08X) = 0x%08X\n",
               p10_x[t], (unsigned)leftmost_one(p10_x[t]));
    }

    printf("\n=== Problem 11 (odd_ones) ===\n");
    unsigned p11_x[] = {0x00000000U, 0x00000001U, 0x00000003U, 0x00000007U, 0xFFFFFFFFU};
    for (int t = 0; t < 5; t++) {
        printf("odd_ones(0x%08X) = %d\n", p11_x[t], odd_ones(p11_x[t]));
    }

    return 0;
}