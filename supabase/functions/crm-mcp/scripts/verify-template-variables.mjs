import { extractTemplateVariables } from '../tools/templateVariables.ts'

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
  console.log(`OK: ${label}`)
}

assertEqual(
  extractTemplateVariables('Hi {{first_name}}, following up from {{company}}.'),
  ['{{first_name}}', '{{company}}'],
  'known tokens extracted in fixed order',
)

assertEqual(
  extractTemplateVariables('Hi there, just checking in.'),
  [],
  'no known tokens present',
)

assertEqual(
  extractTemplateVariables('Hi {{foo}}, unrecognized token stays literal.'),
  [],
  'unrecognized {{foo}} is not included',
)

assertEqual(
  extractTemplateVariables(
    '{{my_portfolio}} {{my_name}} {{website}} {{job_title}} {{company}} {{last_name}} {{first_name}}',
  ),
  [
    '{{first_name}}', '{{last_name}}', '{{company}}',
    '{{job_title}}', '{{website}}', '{{my_name}}', '{{my_portfolio}}',
  ],
  'all 7 tokens in reverse body-order returned in fixed list order',
)

console.log('ALL CHECKS PASSED')
