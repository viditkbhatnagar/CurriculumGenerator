/**
 * GET /api/v3/ai-status: is the AI key working, and which provider and models does it reach?
 *
 * In October 2026 production went 5 days without a working key before anyone could tell, and
 * checking meant borrowing an endpoint that happened to call the model. This makes one tiny
 * chat call and one tiny embedding, and answers from memory for a minute so that it cannot be
 * used to run up a bill.
 */
import { Router, Request, Response } from 'express';
import config from '../config';
import { openaiService } from '../services/openaiService';

const router = Router();
const CACHE_MS = 60_000;
let last: { at: number; body: any } | null = null;

const check = async (work: () => Promise<unknown>) => {
  const started = Date.now();
  try {
    await work();
    return { ok: true, ms: Date.now() - started };
  } catch (error: any) {
    return { ok: false, error: String(error?.message || error).slice(0, 200) };
  }
};

router.get('/', async (_req: Request, res: Response) => {
  if (last && Date.now() - last.at < CACHE_MS) return res.json(last.body);
  const provider = config.openai.azure
    ? 'azure'
    : (config.openai.baseURL || '').includes('openrouter.ai')
      ? 'openrouter'
      : 'openai';
  const [chat, embedding] = await Promise.all([
    check(() =>
      openaiService.generateContent('Reply with one word: ready', undefined, {
        maxTokens: 400,
        reasoningEffort: 'low',
        timeout: 60_000,
      })
    ),
    check(() => openaiService.generateEmbedding('ready')),
  ]);
  const body = {
    success: chat.ok && embedding.ok,
    data: {
      provider,
      // Enough to spot a wrong endpoint or a mangled key, without showing the key.
      endpointHost: config.openai.baseURL ? new URL(config.openai.baseURL).host : 'api.openai.com',
      keyLength: config.openai.apiKey.length,
      chatModel: config.openai.chatModel,
      fastModel: config.openai.stepTiers.find((t) => t.steps.includes('11'))?.model || null,
      embeddingModel: config.openai.embeddingModel,
      chat,
      embedding,
      checkedAt: new Date().toISOString(),
    },
  };
  last = { at: Date.now(), body };
  res.status(body.success ? 200 : 503).json(body);
});

export default router;
