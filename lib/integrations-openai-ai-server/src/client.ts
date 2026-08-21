import OpenAI from "openai";

const apiKey =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "dummy_key";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;

export const openai = new OpenAI({
  apiKey,
  baseURL,
});
