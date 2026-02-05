import express from 'express';
import cors from 'cors';
import { z } from 'zod';

import { FacilitatorServer } from './facilitator/server.js';
import { paymentMiddleware } from './middleware/payment-middleware.js';

const Env = z.object({
  PORT: z.coerce.number().default(3001),
  STARKNET_RPC_URL: z.string().url(),
  NETWORK: z.string().default('starknet-sepolia'),

  FACILITATOR_ACCOUNT_ADDRESS: z.string().min(10),
  FACILITATOR_PRIVATE_KEY: z.string().min(10),

  FACILITATOR_URL: z.string().url().default('http://localhost:3001/api/facilitator'),

  PAY_TO_ADDRESS: z.string().min(10),
  TOKEN_ADDRESS: z.string().min(10),
  PRICE_CHAINSTATUS: z.string().default('$0.005'),
});

type Env = z.infer<typeof Env>;

function loadEnv(): Env {
  // Lazy .env support (optional)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    dotenv.config();
  } catch {}

  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
}

const env = loadEnv();

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // --- Facilitator mounted under /api/facilitator ---
  // FacilitatorServer implements: /health, /supported, /verify, /settle
  const facilitator = new FacilitatorServer({
    network: env.NETWORK as any,
    rpcUrl: env.STARKNET_RPC_URL,
    accountAddress: env.FACILITATOR_ACCOUNT_ADDRESS,
    privateKey: env.FACILITATOR_PRIVATE_KEY,
  } as any);

  app.use('/api/facilitator', (facilitator as any).getApp?.() ?? (facilitator as any).app);

  // --- Resource server / paywall endpoints ---
  app.use(
    '/api/protected',
    paymentMiddleware(env.PAY_TO_ADDRESS, {
      '/chainstatus': env.PRICE_CHAINSTATUS,
    }, {
      facilitatorUrl: env.FACILITATOR_URL,
      tokenAddress: env.TOKEN_ADDRESS,
      network: env.NETWORK as any,
    } as any)
  );

  app.get('/api/protected/chainstatus', async (_req, res) => {
    res.json({
      ok: true,
      network: env.NETWORK,
      rpcUrl: env.STARKNET_RPC_URL,
      time: new Date().toISOString(),
    });
  });

  app.listen(env.PORT, () => {
    console.log(`claw-strk-x402-server listening on http://localhost:${env.PORT}`);
    console.log(`- facilitator: http://localhost:${env.PORT}/api/facilitator/verify`);
    console.log(`- paywalled:   http://localhost:${env.PORT}/api/protected/chainstatus`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
