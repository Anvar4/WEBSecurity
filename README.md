# WEBSecurity (TypeScript Express demo)

This repository contains a minimal Express.js server in TypeScript demonstrating basic security middleware:

- Helmet for HTTP headers
- Rate limiting with `express-rate-limit`
- CSRF protection using `csurf` (with `@types/csurf` installed)
- JWT authentication via cookies

Notes about the recent migration
- The project was originally pushed accidentally to another repo (`Ddos-attack`). The files were removed from that repository and pushed here.
- TypeScript `tsconfig.json` enables `esModuleInterop` and `allowSyntheticDefaultImports` so ESM-style imports like `import csurf from "csurf"` work.

Quick start
1. Install dependencies:

```bash
npm install
```

2. Run the server (development):

```bash
npx ts-node index.ts
```

Security / Production notes
- Set `process.env.SECRET` to a secure value before deploying.
- Use HTTPS in production and set cookies with `secure: true`.
- Consider adding CI to run `npx tsc --noEmit` on push.

If anything is missing or you'd like CI/README enhancements, tell me and I will add them.
