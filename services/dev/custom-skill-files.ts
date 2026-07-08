import type { Plugin } from 'vite';
import {
  deleteCustomSkillMarkdownFile,
  listCustomSkillMarkdownFiles,
  saveCustomSkillMarkdownFile,
  updateCustomSkillMarkdownFile,
} from '../runtime-assets/custom-skill-files.ts';

const readJsonBody = async (req: any) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return {};
  }
};

const writeJson = (res: any, statusCode: number, payload: unknown) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

export const apiCustomSkillFilesPlugin = (): Plugin => ({
  name: 'vite-plugin-api-custom-skill-files',
  configureServer(server) {
    server.middlewares.use('/api/custom-skills', async (req, res) => {
      const requestUrl = new URL(req.url || '/', 'http://localhost');
      const pathname = requestUrl.pathname;
      const normalizedPathname = pathname.startsWith('/api/custom-skills')
        ? pathname.slice('/api/custom-skills'.length) || '/'
        : pathname;

      try {
        if (req.method === 'GET' && normalizedPathname === '/') {
          const items = await listCustomSkillMarkdownFiles();
          writeJson(res, 200, {
            items,
          });
          return;
        }

        if (req.method === 'POST' && normalizedPathname === '/') {
          const body = await readJsonBody(req);
          const item = await saveCustomSkillMarkdownFile({
            id: String(body.id || '').trim(),
            name: String(body.name || '').trim(),
            iconName: String(body.iconName || '').trim() || undefined,
            config:
              body.config && typeof body.config === 'object'
                ? (body.config as Record<string, unknown>)
                : {},
          });
          writeJson(res, 200, { item });
          return;
        }

        if (req.method === 'DELETE' && normalizedPathname.startsWith('/')) {
          const skillId = decodeURIComponent(normalizedPathname.slice(1)).trim();
          if (!skillId) {
            writeJson(res, 400, { error: 'skill_id_required' });
            return;
          }
          const removed = await deleteCustomSkillMarkdownFile({ skillId });
          writeJson(res, 200, { removed });
          return;
        }

        if (req.method === 'PATCH' && normalizedPathname.startsWith('/')) {
          const skillId = decodeURIComponent(normalizedPathname.slice(1)).trim();
          if (!skillId) {
            writeJson(res, 400, { error: 'skill_id_required' });
            return;
          }
          const body = await readJsonBody(req);
          const patch =
            body.patch && typeof body.patch === 'object'
              ? (body.patch as Record<string, unknown>)
              : {};
          const item = await updateCustomSkillMarkdownFile({
            skillId,
            mutate: (current) => ({
              ...current,
              ...patch,
            }),
          });
          if (!item) {
            writeJson(res, 404, { error: 'custom_skill_not_found' });
            return;
          }
          writeJson(res, 200, { item });
          return;
        }

        writeJson(res, 404, { error: 'Not found' });
      } catch (error: any) {
        console.error('[custom-skill-files] request failed', error);
        writeJson(res, 500, {
          error: error?.message || 'custom_skill_file_request_failed',
        });
      }
    });
  },
});
