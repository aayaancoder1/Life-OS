import fastify from 'fastify';
import { config } from './config/index.js';
import { handleTelegramWebhook } from './modules/ingestion/telegram.js';
import { supabase } from './db/supabase.js';

const app = fastify({ logger: true });

// Health check
app.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// Telegram Ingestion Webhook
app.post('/api/v1/ingest/telegram/:token', handleTelegramWebhook);

// Retrieve Items
app.get('/api/v1/items', async (request, reply) => {
  const query = request.query as any;
  const category = query.category;
  const status = query.status;

  let builder = supabase.from('items').select('*').order('created_at', { ascending: false });

  if (category) {
    builder = builder.eq('category', category);
  }
  if (status) {
    builder = builder.eq('status', status);
  }

  const { data, error } = await builder;

  if (error) {
    return reply.status(500).send({ error: error.message });
  }

  return { items: data };
});

// Retrieve Deadlines
app.get('/api/v1/deadlines', async (request, reply) => {
  const { data, error } = await supabase
    .from('deadlines')
    .select(`
      *,
      item:items(*)
    `)
    .order('deadline_at', { ascending: true });

  if (error) {
    return reply.status(500).send({ error: error.message });
  }

  return { deadlines: data };
});

// Simple keyword search across items (title and summary)
app.get('/api/v1/search', async (request, reply) => {
  const query = request.query as any;
  const term = query.q;

  if (!term) {
    return reply.status(400).send({ error: 'Search term "q" is required' });
  }

  // PostgreSQL keyword matching (ILIKE) on title or summary
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or(`title.ilike.%${term}%,summary.ilike.%${term}%`)
    .order('importance_score', { ascending: false });

  if (error) {
    return reply.status(500).send({ error: error.message });
  }

  return { items: data };
});

// Start the server
const start = async () => {
  try {
    const port = parseInt(config.PORT, 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Student OS Server is running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
