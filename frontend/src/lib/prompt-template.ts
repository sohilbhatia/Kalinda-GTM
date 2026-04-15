const STORAGE_KEY = "kalinda-prompt-template";

export const DEFAULT_PROMPT_TEMPLATE = `Search the entire internet and give me recent blogs, articles, podcast appearances, featured videos or anything written by / published about {name} of {firm} within the last 48 months. I am writing an email with a personalization and I want to know of anything he wrote, talked about on a podcast or was featured in. Also see if they are leadership in any mass torts. Find me as many personal things as possible about this person.`;

export function getPromptTemplate(): string {
  if (typeof window === "undefined") return DEFAULT_PROMPT_TEMPLATE;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_PROMPT_TEMPLATE;
}

export function savePromptTemplate(template: string): void {
  localStorage.setItem(STORAGE_KEY, template);
}

export function resetPromptTemplate(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function fillPromptTemplate(template: string, name: string, firm: string): string {
  return template.replace(/\{name\}/g, name).replace(/\{firm\}/g, firm);
}
