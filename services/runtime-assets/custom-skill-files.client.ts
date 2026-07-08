import type {
  CustomSkillConfigRecord,
  CustomSkillMarkdownAsset,
} from './custom-skill-markdown.ts';

const CUSTOM_SKILL_API_ROOT = '/api/custom-skills';

const readJson = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      String(
        payload?.error ||
          payload?.message ||
          `custom_skill_http_${response.status}`,
      ),
    );
  }
  return payload;
};

export const listCustomSkillMarkdownAssetsFromApi = async (): Promise<
  CustomSkillMarkdownAsset[]
> => {
  const response = await fetch(CUSTOM_SKILL_API_ROOT, {
    method: 'GET',
  });
  const payload = await readJson(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const saveCustomSkillMarkdownAssetToApi = async (args: {
  id: string;
  name: string;
  iconName?: string;
  config?: CustomSkillConfigRecord | null;
}): Promise<CustomSkillMarkdownAsset> => {
  const response = await fetch(CUSTOM_SKILL_API_ROOT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: args.id,
      name: args.name,
      iconName: args.iconName,
      config: args.config || {},
    }),
  });
  const payload = await readJson(response);
  if (!payload?.item || typeof payload.item !== 'object') {
    throw new Error('custom_skill_item_missing');
  }
  return payload.item as CustomSkillMarkdownAsset;
};

export const updateCustomSkillMarkdownAssetToApi = async (args: {
  skillId: string;
  patch: Record<string, unknown>;
}): Promise<CustomSkillMarkdownAsset> => {
  const response = await fetch(
    `${CUSTOM_SKILL_API_ROOT}/${encodeURIComponent(String(args.skillId || '').trim())}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patch: args.patch || {},
      }),
    },
  );
  const payload = await readJson(response);
  if (!payload?.item || typeof payload.item !== 'object') {
    throw new Error('custom_skill_item_missing');
  }
  return payload.item as CustomSkillMarkdownAsset;
};

export const deleteCustomSkillMarkdownAssetFromApi = async (
  skillId: string,
): Promise<boolean> => {
  const normalizedId = String(skillId || '').trim();
  if (!normalizedId) return false;

  const response = await fetch(
    `${CUSTOM_SKILL_API_ROOT}/${encodeURIComponent(normalizedId)}`,
    {
      method: 'DELETE',
    },
  );
  const payload = await readJson(response);
  return payload?.removed === true;
};
