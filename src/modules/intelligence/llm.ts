import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { parsedItemSchema, ParsedItem } from './types.js';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
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

Output MUST be a JSON object matching this structure:
{
  "title": "Short descriptive title (max 80 chars)",
  "summary": "Concise bullet-point summary of the core information",
  "category": "one of the enums listed above",
  "status": "one of the enums listed above",
  "importance_score": 1-10 integer,
  "metadata": {
    // any extra structural keys found, e.g. company, location, URL, tags
  },
  "deadlines": [
    {
      "deadline_at": "ISO-8601 Datetime String",
      "description": "Short description of what the deadline is for (e.g. 'Submission deadline', 'Exam time')"
    }
  ]
}
`;

export async function parseCaptureWithAI(rawContent: string, captureTime: Date): Promise<ParsedItem> {
  const referenceTimeStr = captureTime.toISOString();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Reference Current Time: ${referenceTimeStr}\n\nRaw Content to parse:\n${rawContent}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned an empty response');
  }

  const parsedJson = JSON.parse(content);
  // Validate using Zod schema
  return parsedItemSchema.parse(parsedJson);
}
