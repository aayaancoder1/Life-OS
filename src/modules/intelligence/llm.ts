import { GoogleGenAI } from '@google/genai';
import { config } from '../../config/index.js';
import { parsedItemSchema, ParsedItem } from './types.js';

const ai = new GoogleGenAI({
  apiKey: config.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the AI Intelligence Engine of Student OS, acting as an expert Chief of Staff.
Your job is to analyze raw content captured by a student and structure it into a clean, machine-readable JSON object.

You must categorize the information into one of the following:
- 'opportunity': Hackathons, fellowships, scholarships, competitions, internships, cohorts, jobs.
- 'project': Active projects the student builds or works on.
- 'academic': Assignments, exams, attendance warnings, labs, classes.
- 'career': Resume updates, career preparation, applications, interview prep, certifications.
- 'personal': Habits, health, finance, reading, fitness, routines.
- 'idea': Raw, unvetted ideas (e.g. startup ideas, product concepts). These default to 'parking_lot' status.
- 'knowledge': Useful articles, facts, notes, links, or context worth remembering but not actionable.

Assign one of the following statuses:
- 'backlog': Standard actionable items waiting to be worked on.
- 'parking_lot': For 'idea' items, or projects/opportunities not currently active.
- 'in_progress': Currently active items.
- 'completed': Finished tasks/milestones.
- 'archived': No longer relevant.

Assign an importance score between 1 (low importance) and 10 (extremely critical).

Extract any deadlines or events:
- Convert natural dates (e.g., "next Friday at midnight", "tomorrow", "Oct 12") to precise ISO-8601 datetime strings.
- Anchor natural relative times using the Reference Current Time provided.
- If there are no deadlines or events, return an empty array for deadlines.
`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Short descriptive title (max 80 chars)' },
    summary: { type: 'STRING', description: 'Concise bullet-point summary of the core information' },
    category: {
      type: 'STRING',
      enum: ['opportunity', 'project', 'academic', 'career', 'personal', 'idea', 'knowledge'],
      description: 'The category of the item'
    },
    status: {
      type: 'STRING',
      enum: ['backlog', 'parking_lot', 'in_progress', 'completed', 'archived'],
      description: 'The status of the item'
    },
    importance_score: { type: 'INTEGER', description: 'Importance score between 1 and 10' },
    metadata: { type: 'OBJECT', description: 'Any extra structural keys found, e.g. company, location, URL, tags' },
    deadlines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          deadline_at: { type: 'STRING', description: 'ISO-8601 Datetime String' },
          description: { type: 'STRING', description: 'Short description of what the deadline is for' }
        },
        required: ['deadline_at']
      },
      description: 'List of deadlines'
    }
  },
  required: ['title', 'category', 'status', 'importance_score']
};

export async function parseCaptureWithAI(rawContent: string, captureTime: Date): Promise<ParsedItem> {
  const referenceTimeStr = captureTime.toISOString();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Reference Current Time: ${referenceTimeStr}\n\nRaw Content to parse:\n${rawContent}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: responseSchema as any,
      temperature: 0.1,
    }
  });

  const content = response.text;
  if (!content) {
    throw new Error('LLM returned an empty response');
  }

  const parsedJson = JSON.parse(content);
  // Validate using Zod schema
  return parsedItemSchema.parse(parsedJson);
}
