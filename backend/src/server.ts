import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { GeminiTranscriptionService } from './services/transcription/GeminiTranscriptionService';
import { MockTranscriptionService } from './services/transcription/MockTranscriptionService';
import { GeminiImageParsingService } from './services/imageParsing/GeminiImageParsingService';
import { MockImageParsingService } from './services/imageParsing/MockImageParsingService';
import { TransactionService } from './services/transaction/TransactionService';
import { TextParserService } from './services/transaction/TextParserService';
import { createTransactionSchema, updateTransactionSchema, parseTextSchema } from './services/transaction/types';
import { runMigrations } from './db/migrate';
import { initAuth, requireAuth, userIdOf } from './middleware/auth';
import { CORS_ORIGINS, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from './config';
import { pool } from './db';

const app = express();
const port = process.env.PORT || 3001;

// Rendered behind a reverse proxy (Cloudflare / Render), so trust its headers.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
});

// Screenshot uploads: same in-memory approach, smaller cap and a MIME allowlist.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype.toLowerCase())) {
      return cb(null, true);
    }
    const err: any = new Error(
      'Format gambar tidak didukung. Gunakan PNG, JPEG, atau WebP.'
    );
    err.statusCode = 415;
    cb(err);
  },
});

// Voice parsing is comparatively expensive; keep a firm per-client ceiling.
const parseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
});

// Transcription Service (From Tahap A)
let transcriptionService: any;
try {
  transcriptionService = new GeminiTranscriptionService();
  console.log('Using Gemini API for transcription');
} catch (e: any) {
  console.warn('Falling back to Mock API:', e.message);
  transcriptionService = new MockTranscriptionService();
}

// Screenshot Parsing Service (m-banking / e-wallet statements)
let imageParsingService: any;
try {
  imageParsingService = new GeminiImageParsingService();
  console.log('Using Gemini API for screenshot parsing');
} catch (e: any) {
  console.warn('Falling back to Mock image parsing:', e.message);
  imageParsingService = new MockImageParsingService();
}

// Health check (public) — used by Render and uptime monitors.
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', time: new Date().toISOString() });
  } catch (error: any) {
    res.status(503).json({ status: 'degraded', database: 'down', message: error.message });
  }
});

// Everything under /api requires a valid Supabase access token.
app.use('/api', requireAuth);

// -------------------------------------------------------------
// Voice & Text Parsing Endpoints
// -------------------------------------------------------------

// Voice Parse (Tahap A)
app.post('/api/voice/parse', parseLimiter, upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const result = await transcriptionService.transcribe(audioFile.buffer, audioFile.mimetype);
    res.json(result);
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription processing failed', message: error?.message });
  }
});

// Text Parse: "Ketik saja" / quick input (PRD FR07 & Bagian 10)
app.post('/api/text/parse', parseLimiter, async (req, res) => {
  try {
    const parsedBody = parseTextSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsedBody.error.format() });
    }

    const result = TextParserService.parse(parsedBody.data.text);
    res.json(result);
  } catch (error: any) {
    console.error('Text parsing error:', error);
    res.status(500).json({ error: 'Text parsing failed' });
  }
});

// Screenshot Parse: shared/uploaded m-banking or e-wallet screenshots.
// Returns the same shape as a voice result so the client opens the same review modal.
app.post('/api/image/parse', parseLimiter, uploadImage.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    if (!imageFile) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const result = await imageParsingService.parseImage(imageFile.buffer, imageFile.mimetype);
    res.json(result);
  } catch (error: any) {
    console.error('Screenshot parsing error:', error);
    res.status(500).json({ error: 'Screenshot processing failed', message: error?.message });
  }
});

// -------------------------------------------------------------
// Transaction CRUD Endpoints (Tahap B: FR05, FR06, FR08)
// -------------------------------------------------------------

// Create Transaction with Idempotency & 60s duplicate check
app.post('/api/transactions', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const validation = createTransactionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues.map(issue => issue.message).join(', ')
      });
    }

    const result = await TransactionService.create(userId, validation.data);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create transaction error:', error);
    if (error.code === 'POSSIBLE_DUPLICATE') {
      return res.status(409).json({
        code: error.code,
        message: error.message,
        isWarning: true
      });
    }
    res.status(500).json({ error: error.message || 'Failed to create transaction' });
  }
});

// List Transactions with month & type filter
app.get('/api/transactions', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const { month, type, limit, offset } = req.query;

    const list = await TransactionService.list(userId, {
      month: month as string | undefined,
      type: type as 'INCOME' | 'EXPENSE' | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined
    });

    res.json(list);
  } catch (error: any) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
});

// 3 Recent Transactions for Home
app.get('/api/transactions/recent', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const recent = await TransactionService.getRecent(userId);
    res.json(recent);
  } catch (error: any) {
    console.error('Recent transactions error:', error);
    res.status(500).json({ error: 'Failed to retrieve recent transactions' });
  }
});

// Monthly Summary (Total Expense, Income, Net Balance, Top Categories)
app.get('/api/summary', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const month = req.query.month as string | undefined;

    const summary = await TransactionService.getSummary(userId, month);
    res.json(summary);
  } catch (error: any) {
    console.error('Summary calculation error:', error);
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

// Update Transaction (Optimistic Concurrency)
app.patch('/api/transactions/:id', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const id = req.params.id;
    const validation = updateTransactionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues.map(issue => issue.message).join(', ')
      });
    }

    const updated = await TransactionService.update(userId, id, validation.data);
    res.json(updated);
  } catch (error: any) {
    console.error('Update transaction error:', error);
    if (error.statusCode === 409) {
      return res.status(409).json({ code: error.code, message: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
});

// Soft Delete Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const id = req.params.id;

    const deleted = await TransactionService.delete(userId, id);
    res.json({ message: 'Transaction deleted successfully', transaction: deleted });
  } catch (error: any) {
    console.error('Delete transaction error:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to delete transaction' });
  }
});

// Restore Transaction (within 7 days)
app.post('/api/transactions/:id/restore', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const id = req.params.id;

    const restored = await TransactionService.restore(userId, id);
    res.json({ message: 'Transaction restored successfully', transaction: restored });
  } catch (error: any) {
    console.error('Restore transaction error:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to restore transaction' });
  }
});

// Multer and generic error handler (runs after routes).
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res
      .status(413)
      .json({ error: 'File terlalu besar. Maksimal 10 MB untuk audio dan 8 MB untuk gambar.' });
  }
  if (err?.statusCode === 415) {
    return res.status(415).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

// Start Server
async function start() {
  try {
    await initAuth();
  } catch (e: any) {
    console.error(`❌ Auth initialization failed: ${e.message}`);
    process.exit(1);
  }

  app.listen(port, async () => {
    try {
      await runMigrations();
    } catch (e: any) {
      console.error('Initial migration warning:', e.message);
    }
    console.log(`Backend server running at http://localhost:${port}`);
  });
}

start();
