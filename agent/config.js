import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const agentDir = fileURLToPath(new URL('.', import.meta.url));

export function loadConfig() {
  const envPath = resolve(agentDir, '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required.');
  if (!process.env.AGENT_SECRET?.trim()) throw new Error('AGENT_SECRET is required.');
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port.');
  return { apiKey: process.env.OPENAI_API_KEY, secret: process.env.AGENT_SECRET, port,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' };
}

export function readProfile() {
  const text = readFileSync(resolve(agentDir, 'interests.txt'), 'utf8').trim();
  if (!text || text.length > 8000) throw new Error('interests.txt must contain a short, nonempty profile.');
  return text;
}
