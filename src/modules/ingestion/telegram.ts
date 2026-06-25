import { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../../db/supabase.js';
import { config } from '../../config/index.js';

interface TelegramWebhookBody {
  update_id: number;
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
    from?: {
      id: number;
      username?: string;
    };
    text?: string;
    caption?: string;
    date: number;
  };
}

export async function handleTelegramWebhook(
  request: FastifyRequest<{ Body: TelegramWebhookBody; Params: { token: string } }>,
  reply: FastifyReply
) {
  const { token } = request.params;

  // Simple token validation
  if (token !== config.TELEGRAM_BOT_TOKEN) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const { body } = request;
  if (!body.message) {
    // We receive other updates (edited messages, inline queries, etc.) which we can safely ignore/return 200 for MVP
    return reply.status(200).send({ ok: true });
  }

  const rawText = body.message.text || body.message.caption || '';
  if (!rawText.trim()) {
    return reply.status(200).send({ ok: true, message: 'Empty message ignored' });
  }

  try {
    // Insert into captures table as 'pending'
    const { data, error } = await supabase
      .from('captures')
      .insert({
        source: 'telegram',
        raw_content: rawText,
        metadata: {
          chat_id: body.message.chat.id,
          message_id: body.message.message_id,
          username: body.message.from?.username,
          telegram_date: body.message.date,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting raw capture:', error);
      return reply.status(500).send({ error: 'Database write failed' });
    }

    // Return fast 200 OK
    return reply.status(200).send({ ok: true, capture_id: data.id });
  } catch (err) {
    console.error('Failed to handle telegram webhook:', err);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}
