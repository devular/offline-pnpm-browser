import { request } from "undici";

const NPM_REGISTRY = "https://registry.npmjs.org";

export function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchNpmSearch(keyword, size = 20, retries = 3) {
  const url = `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(keyword)}&size=${size}&quality=0.5&popularity=0.9`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { statusCode, body } = await request(url);
      const data = await body.json();

      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      return data.objects || [];
    } catch (err) {
      log(`Search "${keyword}" attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await delay(1000 * attempt);
      }
    }
  }

  log(`Search "${keyword}" failed after ${retries} retries, skipping`);
  return [];
}
