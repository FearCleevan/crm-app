export const TEMPLATE_VARIABLE_TOKENS = [
  '{{first_name}}',
  '{{last_name}}',
  '{{company}}',
  '{{job_title}}',
  '{{website}}',
  '{{my_name}}',
  '{{my_portfolio}}',
]

export function extractTemplateVariables(body: string): string[] {
  return TEMPLATE_VARIABLE_TOKENS.filter((token) => body.includes(token))
}
