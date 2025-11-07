// Bu kodning asosiy maqsadi va ishlash printsiplari:
// Har bir client (IP manzil bo'yicha) uchun alohida "chelak" (bucket) yaratiladi.

// Har bir bucket'da ma'lum miqdorda token bo'ladi (maksimum 50 ta).

// Vaqt o'tishi bilan tokenlar sekin-asta to'ldiriladi (sekundiga 10 ta).

// Har bir API so'rovi uchun 1 ta token sarflanadi.

// Agar client'da yetarli token bo'lmasa, "Too many requests" xatosi qaytariladi.

import { Request, Response, NextFunction } from 'express';

// Bu type API so'rovlarini cheklash uchun har bir client uchun saqlanadigan ma'lumotlarni belgilaydi
type Bucket = {
    tokens: number;  // Qolgan tokenlar soni
    last: number;    // Oxirgi so'rov vaqti (millisekundlarda)
};

// Asosiy sozlamalar
const RATE = 10;            // Har sekundda qo'shiladigan tokenlar soni
const CAPACITY = 50;        // Maksimal token sig'imi
const REFILL_INTERVAL = 1000; // Token to'ldirish intervali (ms)

// Barcha clientlar uchun bucket'larni saqlash
const buckets = new Map<string, Bucket>();

// Client identifikatorini olish uchun funksiya
function getKey(req: Request) {
    // IP manzilni olishning turli usullari
    return (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string;
}

// Asosiy middleware funksiyasi
export function tokenBucket(req: Request, res: Response, next: NextFunction) {
    // Client ID'sini olish
    const key = getKey(req) || 'anon';
    const now = Date.now();
    let bucket = buckets.get(key);

    // Yangi client uchun bucket yaratish
    if (!bucket) {
        bucket = { tokens: CAPACITY, last: now };
        buckets.set(key, bucket);
    }

    // Tokenlarni qayta to'ldirish
    const delta = (now - bucket.last) / 1000;  // Oxirgi so'rovdan beri o'tgan vaqt (sekundlarda)
    if (delta > 0) {
        // Yangi tokenlar qo'shish, lekin CAPACITY dan oshmasligi kerak
        bucket.tokens = Math.min(CAPACITY, bucket.tokens + delta * RATE);
        bucket.last = now;
    }

    // Har bir so'rov uchun "narx"
    const cost = 1;

    // Agar yetarli token bo'lsa
    if (bucket.tokens >= cost) {
        bucket.tokens -= cost;  // Token ishlatiladi
        next();  // So'rov davom etadi
    } else {
        // Token yetarli bo'lmasa, 429 (Too Many Requests) xatosi qaytariladi
        res.status(429).json({ error: 'Too many requests — slow down' });
    }
}