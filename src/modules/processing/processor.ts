import { supabase } from '../../db/supabase.js';
import { parseCaptureWithAI } from '../intelligence/llm.js';
import { createGoogleCalendarEvent } from '../action/calendar.js';

export async function processPendingCaptures(): Promise<number> {
  // Fetch pending captures using the atomic stored function (claim_pending_captures)
  const { data: captures, error: fetchError } = await supabase
    .rpc('claim_pending_captures', { limit_count: 10 });

  if (fetchError) {
    console.error('Error fetching pending captures:', fetchError);
    return 0;
  }

  if (!captures || captures.length === 0) {
    return 0;
  }

  console.log(`Processing ${captures.length} pending captures...`);
  let processedCount = 0;

  for (const capture of captures) {
    try {
      console.log(`Analyzing capture ${capture.id} with LLM...`);
      // Parse using LLM
      const structuredItem = await parseCaptureWithAI(
        capture.raw_content,
        new Date(capture.created_at)
      );

      console.log(`LLM analysis complete. Creating Item: "${structuredItem.title}"`);

      // Begin DB transaction simulation (insert item)
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .insert({
          capture_id: capture.id,
          title: structuredItem.title,
          summary: structuredItem.summary,
          category: structuredItem.category,
          status: structuredItem.status,
          importance_score: structuredItem.importance_score,
          metadata: structuredItem.metadata,
        })
        .select()
        .single();

      if (itemError) {
        throw new Error(`Failed to create item in DB: ${itemError.message}`);
      }

      // Log activity
      await supabase.from('activity_log').insert({
        item_id: itemData.id,
        action: 'created',
        new_state: itemData,
      });

      // Insert deadlines and trigger actions
      if (structuredItem.deadlines && structuredItem.deadlines.length > 0) {
        console.log(`Processing ${structuredItem.deadlines.length} deadlines for Item ${itemData.id}`);

        for (const deadline of structuredItem.deadlines) {
          const { data: deadlineData, error: deadlineError } = await supabase
            .from('deadlines')
            .insert({
              item_id: itemData.id,
              deadline_at: deadline.deadline_at,
              sync_status: 'pending',
            })
            .select()
            .single();

          if (deadlineError) {
            console.error('Failed to save deadline to DB:', deadlineError);
            continue;
          }

          // Trigger Google Calendar sync
          try {
            console.log(`Syncing deadline to Google Calendar: ${deadline.deadline_at}`);
            const eventId = await createGoogleCalendarEvent({
              title: `${itemData.title} [${itemData.category.toUpperCase()}]`,
              description: deadline.description || itemData.summary || '',
              startAt: deadline.deadline_at,
            });

            // Update deadline with calendar event ID
            await supabase
              .from('deadlines')
              .update({
                calendar_event_id: eventId,
                sync_status: 'synced',
              })
              .eq('id', deadlineData.id);
            
            console.log(`Synced successfully. Event ID: ${eventId}`);
          } catch (syncErr) {
            console.error(`Google Calendar sync failed for deadline ${deadlineData.id}:`, syncErr);
            await supabase
              .from('deadlines')
              .update({ sync_status: 'failed' })
              .eq('id', deadlineData.id);
          }
        }
      }

      // Finalize capture processing
      await supabase
        .from('captures')
        .update({ status: 'processed' })
        .eq('id', capture.id);

      processedCount++;
    } catch (err: any) {
      console.error(`Failed to process capture ${capture.id}:`, err);
      // Mark as failed
      await supabase
        .from('captures')
        .update({
          status: 'failed',
          metadata: {
            ...capture.metadata,
            error: err.message || String(err),
          },
        })
        .eq('id', capture.id);
    }
  }

  return processedCount;
}
