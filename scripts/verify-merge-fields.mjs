import { resolveMergeFields } from '../src/lib/mergeFields.ts'

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
  console.log(`OK: ${label}`)
}

assertEqual(
  resolveMergeFields(
    'Hi {{first_name}} {{last_name}} ({{full_name}}) at {{company}}, {{job_title}}, {{website}} — {{my_name}} / {{my_portfolio}}',
    {
      first_name: 'John', last_name: 'Smith', full_name: 'John Smith',
      company: 'Acme Corp', job_title: 'CEO', website: 'acme.com',
      my_name: 'Peter Lazan', my_portfolio: 'lazandev.vercel.app',
    },
  ),
  'Hi John Smith (John Smith) at Acme Corp, CEO, acme.com — Peter Lazan / lazandev.vercel.app',
  'all 8 tokens resolve when every value is supplied',
)

assertEqual(
  resolveMergeFields('Hi {{first_name}}, welcome to {{company}}.', {}),
  'Hi , welcome to .',
  'missing values resolve to empty string',
)

assertEqual(
  resolveMergeFields('Hi {{foo}}, {{first_name}}!', { first_name: 'Jane' }),
  'Hi {{foo}}, Jane!',
  'unrecognized token is left untouched',
)

assertEqual(
  resolveMergeFields(
    '{{my_portfolio}} {{my_name}} {{website}} {{job_title}} {{company}} {{full_name}} {{last_name}} {{first_name}}',
    {
      first_name: 'A', last_name: 'B', full_name: 'C', company: 'D',
      job_title: 'E', website: 'F', my_name: 'G', my_portfolio: 'H',
    },
  ),
  'H G F E D C B A',
  'all 8 tokens in scrambled order all resolve in one pass',
)

console.log('ALL CHECKS PASSED')
