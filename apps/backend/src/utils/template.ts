const NAME_REGEX = /^[a-z0-9_]{3,64}$/;
const VARIABLE_REGEX = /\{\{\s*(\d+)\s*\}\}/g;

export function isValidTemplateName(name: string): boolean {
  return NAME_REGEX.test(name);
}

export function extractVariableCount(body: string): number {
  const found = new Set<number>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_REGEX);
  while ((match = regex.exec(body)) !== null) {
    found.add(Number(match[1]));
  }
  return found.size;
}

export function renderTemplateBody(body: string, variables: Record<string, string>): string {
  return body.replace(VARIABLE_REGEX, (_, index: string) => variables[index] ?? `{{${index}}}`);
}
