import { AppError } from '../middleware/errorHandler.js';

export const getRequiredRouteParam = (
  value: string | string[] | undefined,
  name = 'id'
): string => {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (!normalized) {
    throw new AppError(400, `缺少路由参数: ${name}`);
  }

  return normalized;
};
