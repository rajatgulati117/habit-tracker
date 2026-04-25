export type CategoryRow = {
  id: string;
  user_id?: string;
  name: string;
  color: string;
  created_at: string;
};

export type CategoryOption = {
  id: string;
  name: string;
  color: string;
};

export const MAX_CATEGORY_NAME_LENGTH = 50;
export const UNCATEGORIZED_GROUP_LABEL = "Uncategorized";
export const DEFAULT_CATEGORY_COLOR = "#22C55E";

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

export function normalizeCategoryColor(color: string) {
  return color.trim().toUpperCase();
}

export function validateCategoryName(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return "Enter a category name.";
  }

  if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
    return `Category names must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`;
  }

  return null;
}

export function validateCategoryColor(color: string) {
  const normalizedColor = normalizeCategoryColor(color);

  if (!HEX_COLOR_PATTERN.test(normalizedColor)) {
    return "Choose a valid hex color.";
  }

  return null;
}
