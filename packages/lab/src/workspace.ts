import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const LanguageSchema = z.enum(['Any', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust']);
export const PreferencesSchema = z.object({ language: LanguageSchema, minStars: z.number().int().min(0).max(1_000_000) }).strict();
export const SearchSchema = z.object({
  kind: z.literal('search'), query: z.string().trim().min(1).max(160),
  language: LanguageSchema.optional(), minStars: z.number().int().min(0).max(1_000_000).optional(),
}).strict();
export const TaskInputSchema = z.discriminatedUnion('kind', [SearchSchema, z.object({ kind: z.literal('refresh') }).strict()]);
export const TaskRequestSchema = z.object({ requestId: z.uuid(), task: TaskInputSchema }).strict();
export type TaskInput = z.infer<typeof TaskInputSchema>;
export type Search = Required<z.infer<typeof SearchSchema>>;
export interface Preferences extends z.infer<typeof PreferencesSchema> { version: number; updatedAt: string; }
export interface MemoryNote { id: string; text: string; origin: 'user'; confidence: 'user-provided'; revision: number; createdAt: string; updatedAt: string; history: { text: string; at: string }[]; }
export interface Project {
  fullName: string; url: string; apiUrl: string; sourceUrl: string; description: string; language: string | null;
  stars: number; forks: number; openIssues: number; pushedAt: string; archived: boolean; fork: boolean;
  license: string | null; observedAt: string;
}
export interface SavedProject { id: string; project: Project; taskId: string; savedAt: string; origin: 'github-api'; confidence: 'source-checked'; }
export interface Recipe { id: string; name: string; search: Search; createdAt: string; }
export interface ResearchTask {
  id: string; request: TaskInput; resolved: Search | { kind: 'refresh'; projects: string[] };
  status: 'running' | 'completed' | 'partial' | 'failed' | 'interrupted'; startedAt: string; durationMs: number;
  steps: { at: string; message: string }[]; results: Project[]; errors: string[];
  recalled: { preferencesVersion: number; notes: { id: string; text: string; revision: number }[]; baselines: SavedProject[] };
  changes: { project: string; field: string; before: string | number | boolean | null; after: string | number | boolean | null }[];
  sourceRequests: number; modelCalls: 0;
}
export interface Workspace {
  schemaVersion: 1; preferences: Preferences; notes: MemoryNote[]; projects: SavedProject[]; recipes: Recipe[]; tasks: ResearchTask[]; retiredTaskIds: string[];
}
export function emptyWorkspace(): Workspace {
  return { schemaVersion: 1, preferences: { language: 'Any', minStars: 100, version: 1, updatedAt: new Date().toISOString() }, notes: [], projects: [], recipes: [], tasks: [], retiredTaskIds: [] };
}
export function recallNotes(notes: MemoryNote[], query: string): ResearchTask['recalled']['notes'] {
  const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return notes.map(note => ({ note, score: terms.filter(term => note.text.toLowerCase().includes(term)).length }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)
    .map(({ note }) => ({ id: note.id, text: note.text, revision: note.revision }));
}
export function editNote(workspace: Workspace, id: string | undefined, text: string): MemoryNote {
  const now = new Date().toISOString();
  if (id) {
    const note = workspace.notes.find(note => note.id === id);
    if (!note) throw new Error('Note not found.');
    note.history = [...note.history, { text: note.text, at: note.updatedAt }].slice(-5);
    note.text = text; note.revision++; note.updatedAt = now;
    return note;
  }
  if (workspace.notes.length >= 50) throw new Error('Memory note limit reached. Forget a note first.');
  const note: MemoryNote = { id: randomUUID(), text, origin: 'user', confidence: 'user-provided', revision: 1, createdAt: now, updatedAt: now, history: [] };
  workspace.notes.push(note);
  return note;
}
