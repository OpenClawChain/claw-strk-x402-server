# claw-strk-x402-server

Single-process **Express** server that exposes both:

- **Resource server / paywall** endpoints (x402-protected)
- **Facilitator** endpoints (`/api/facilitator/verify` + `/api/facilitator/settle`)

## Run

```bash
pnpm i
pnpm dev
```

## Endpoints

- Paywalled example: `GET /api/protected/chainstatus`
- Facilitator:
  - `POST /api/facilitator/verify`
  - `POST /api/facilitator/settle`

## Env

Copy `.env.example` → `.env`.
