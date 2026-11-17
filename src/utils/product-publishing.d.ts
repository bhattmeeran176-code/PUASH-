export function validateProductPublishing(input: { active: boolean; categoryId: string; description: string; imageSelected: boolean }): 'category' | 'description' | 'image' | null;
