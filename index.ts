/**
 * app.ts
 * ----------------------------
 * Bitta TypeScript faylda minimal va amaliy xavfsizlik qatlamlari bilan
 * Express server misoli:
 *   - Helmet (HTTP header security)
 *   - Rate limiting (express-rate-limit)
 *   - CSRF himoyasi (csurf)
 *   - JWT autentifikatsiya (cookie orqali)
 *   - Xato middleware (xatolarni yashirish)
 *
 * Qanday ishlaydi:
 *   1) POST /login   -> username + password yubor (demo: password = "12345")
 *        - muvaffaqiyatli bo'lsa, cookie sifatida JWT yuboradi va csrf token qaytaradi
 *   2) GET /profile  -> cookie ichidagi JWT orqali autentifikatsiya qilinadi
 *
 * Talablar (terminalda bir marta):
 *   npm init -y
 *   npm i express helmet express-rate-limit jsonwebtoken cookie-parser csurf
 *   npm i -D typescript ts-node @types/express @types/node @types/jsonwebtoken @types/cookie-parser
 *   npx tsc --init
 *
 * Ishga tushirish:
 *   npx ts-node app.ts
 *
 * Muhim xavfsizlik eslatmalari (production uchun):
 *   - HAR DOIM process.env.SECRET ni o'rnating; fayl ichida qattiq kodlangan sirlardan foydalanmang.
 *   - HTTPS qo'llang (secure cookie uchun res.cookie(... secure: true)).
 *   - CSRF tokenni clientda to'g'ri saqlang va har POST/PUT/DELETE so'rovga yuboring.
 *   - Rate limit parametrlarini trafik va biznes talablariga moslang.
 *   - Loglarni va monitoringni qo'shing (Sentry/Loggly/Grafana).
 *

 */

import cookieParser from "cookie-parser";
import csurf from "csurf";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";

const app = express();
const PORT = Number(process.env.PORT || 3000);

// === Konfiguratsiya / Muhit o'zgaruvchilari ===
// SECRET ni productionda muhofaza qiling (masalan: environment variable, secrets manager)
const SECRET = process.env.SECRET || "SUPER_TIZIM_SIRI"; // PRODUCTION: o'zgartiring!

// Agar orqa tomonda Cloudflare yoki boshqa proxy bo'lsa:
// app.set('trust proxy', true);
app.set("trust proxy", true);

// --- 1. Middlewarelar ---
app.use(helmet()); // Xavfsiz HTTP headerlar
app.use(express.json());
app.use(cookieParser());

// --- 2. Rate limit (DDoS va brute-force'ga qarshi) ---
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 10, // Har IP uchun 1 daqiqada maksimal 10 ta so'rov
  standardHeaders: true,
  legacyHeaders: false,
  message: "Juda ko'p so'rov! Keyinroq urinib ko'ring.",
});
app.use(limiter);

// --- 3. CSRF himoyasi ---
// CSRF cookie orqali ishlaydi: client login bo'lgach server tomonidan yuborilgan csrf tokenni
// har POST/PUT/DELETE so'rovga yuborishi kerak (odatda header yoki form field orqali).
const csrfProtection = csurf({
  cookie: true,
});
app.use(csrfProtection);

// --- 4. JWT bilan autentifikatsiya middleware'i ---
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Token topilmadi" });

  try {
    const decoded = jwt.verify(token, SECRET) as { id: number; name: string };
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Noto'g'ri yoki muddati o'tgan token" });
  }
}

// --- 5. Oddiy login endpoint (demo maqsadida) ---
// Eslatma: real loyihada parollarni hashing (bcrypt) bilan saqlang va tekshiring.
app.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Demo uchun oddiy tekshiruv (haqiqiy loyihada emas)
  if (!username || !password) {
    return res.status(400).json({ message: "username va password kerak" });
  }

  if (password !== "12345") return res.status(401).json({ message: "Parol xato" });

  const token = jwt.sign({ id: 1, name: username }, SECRET, { expiresIn: "1h" });

  // Cookie sozlamalari:
  // - httpOnly: true  -> JS orqali o'qilmaydi (XSSga qarshi)
  // - secure: true    -> faqat HTTPS bo'lganda yuboriladi (productionda true qilinsin)
  // - sameSite: 'strict' -> CSRF xavfini kamaytiradi
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // productionda HTTPS bo'lsa true
    sameSite: "strict",
    maxAge: 60 * 60 * 1000, // 1 soat
  });

  // CSRF tokenni clientga yuboramiz (client uni keyingi so'rovlarda yuborishi kerak)
  res.json({ message: "Login muvaffaqiyatli", csrfToken: req.csrfToken() });
});

// --- 6. Himoyalangan endpoint ---
app.get("/profile", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    message: `Salom, ${user.name}! Bu sahifa faqat autentifikatsiyadan o'tgan foydalanuvchilar uchun.`,
  });
});

// --- 7. Logout (cookie o'chirish) ---
app.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Chiqish amalga oshirildi" });
});

// --- 8. Xatoliklarni boshqarish ---
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // CSRF token bilan bog'liq xato
  if (err && err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ message: "CSRF token noto'g'ri yoki yo'q" });
  }

  // Rate limiter xabari avtomatik qaytariladi, ammo boshqa xatolarni tutamiz
  console.error("Server xatosi:", err && err.stack ? err.stack : err);
  // Foydalanuvchiga texnik tafsilotlarni bermaymiz
  res.status(500).json({ message: "Serverda xato yuz berdi" });
});

// --- 9. Test uchun oddiy root endpoint ---
app.get("/", (req: Request, res: Response) => {
  res.send("Server ishlayapti. /login bilan boshlang.");
});

// --- 10. Serverni ishga tushirish ---
app.listen(PORT, () => {
  console.log(`✅ Server ishga tushdi: http://localhost:${PORT} (PORT=${PORT})`);
});
