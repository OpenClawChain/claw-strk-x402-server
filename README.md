# claw-strk-x402-server

Single-process **Express** server that runs both:

- **Resource server / paywall** endpoints (x402-protected)
- **Facilitator** endpoints (`/api/facilitator/verify` + `/api/facilitator/settle`)

This is intended as a simple local dev server so you can:
1) spin up a facilitator
2) host a paywalled API route
3) test an x402-capable client end-to-end

> Network: **Starknet Sepolia** by default.

---

## 1) Setup

```bash
pnpm i
cp .env.example .env
```

Edit `.env` and set at minimum:

- `STARKNET_RPC_URL`
- `FACILITATOR_ACCOUNT_ADDRESS`
- `FACILITATOR_PRIVATE_KEY`
- `PAY_TO_ADDRESS`

Notes:
- The facilitator settlement account should be a funded Sepolia Starknet account (it signs settlement txs).
- `PAY_TO_ADDRESS` is where the paywall expects payment to be directed.
- `TOKEN_ADDRESS` defaults to USDC Sepolia in `.env.example`.

---

## 2) Run the server

Dev (auto-reload):

```bash
pnpm dev
```

Prod:

```bash
pnpm build
pnpm start
```

When running, you should see:

- facilitator: `http://localhost:<PORT>/api/facilitator/verify`
- paywalled: `http://localhost:<PORT>/api/protected/chainstatus`

---

## 3) Endpoints

### Health

- `GET /health` → `{ ok: true }`

### Facilitator

Mounted at `/api/facilitator`.

- `GET /api/facilitator/health`
- `GET /api/facilitator/supported`
- `POST /api/facilitator/verify`
- `POST /api/facilitator/settle`

### Paywalled resource server

Mounted at `/api/protected` and guarded by the payment middleware.

Example route:
- `GET /api/protected/chainstatus`

The price map is configured in `src/index.ts`:

- `/chainstatus` → `PRICE_CHAINSTATUS` (default `$0.005`)

---

## 4) Facilitator URL wiring

By default, the resource server calls the facilitator in the same process:

- `FACILITATOR_URL=http://localhost:3001/api/facilitator`

If you want to run the facilitator elsewhere (or separately), point `FACILITATOR_URL` at that base path.

---

## 5) Troubleshooting

- If the server fails to boot, it’s usually missing required env vars (zod validation will throw).
- If settlement fails, verify:
  - the facilitator account is funded on Sepolia
  - `STARKNET_RPC_URL` is correct and reachable
  - `NETWORK=starknet-sepolia`
