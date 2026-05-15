import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DISPOSITION_CODES, EMAIL_STATUSES, PROVIDERS, INDUSTRIES, COUNTRIES } from '@/constants/mockData'
import type { Prospect } from '@/constants/mockData'

export const prospectSchema = z.object({
  firstname:          z.string().min(1, 'First name is required'),
  lastname:           z.string().min(1, 'Last name is required'),
  jobtitle:           z.string().optional(),
  company:            z.string().min(1, 'Company is required'),
  email:              z.string().min(1, 'Email is required').email('Enter a valid email'),
  emailcode:          z.string().optional(),
  dispositioncode:    z.string().optional(),
  providercode:       z.string().optional(),
  status:             z.enum(['New', 'Contacted', 'Qualified', 'Closed']),
  website:            z.string().optional(),
  personallinkedin:   z.string().optional(),
  companylinkedin:    z.string().optional(),
  altphonenumber:     z.string().optional(),
  companyphonenumber: z.string().optional(),
  address:            z.string().optional(),
  street:             z.string().optional(),
  city:               z.string().optional(),
  state:              z.string().optional(),
  postalcode:         z.string().optional(),
  country:            z.string().optional(),
  industry:           z.string().optional(),
  employeesize:       z.coerce.number().min(0).optional(),
  annualrevenue:      z.coerce.number().min(0).optional(),
  seniority:          z.string().optional(),
  department:         z.string().optional(),
  comments:           z.string().optional(),
})

export type ProspectFormValues = z.infer<typeof prospectSchema>

interface FieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}

function Field({ label, error, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-rose-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  )
}

const inputCls = (hasError?: boolean) => cn(
  'w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  hasError ? 'border-rose-500' : 'border-input hover:border-muted-foreground'
)

const selectCls = inputCls

interface ProspectFormProps {
  defaultValues?: Partial<ProspectFormValues>
  onSubmit: (data: ProspectFormValues) => void | Promise<void>
  onCancel: () => void
  submitLabel?: string
  isLoading?: boolean
}

export function ProspectForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save', isLoading }: ProspectFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    defaultValues: { status: 'New', ...defaultValues },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" required error={errors.firstname?.message}>
          <input {...register('firstname')} placeholder="Alice" className={inputCls(!!errors.firstname)} />
        </Field>
        <Field label="Last Name" required error={errors.lastname?.message}>
          <input {...register('lastname')} placeholder="Johnson" className={inputCls(!!errors.lastname)} />
        </Field>
      </div>
      <Field label="Email" required error={errors.email?.message}>
        <input {...register('email')} type="email" placeholder="alice@company.com" className={inputCls(!!errors.email)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job Title" error={errors.jobtitle?.message}>
          <input {...register('jobtitle')} placeholder="CEO" className={inputCls()} />
        </Field>
        <Field label="Company" required error={errors.company?.message}>
          <input {...register('company')} placeholder="Acme Corp" className={inputCls(!!errors.company)} />
        </Field>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alt Phone">
          <input {...register('altphonenumber')} placeholder="+61 400 000 000" className={inputCls()} />
        </Field>
        <Field label="Company Phone">
          <input {...register('companyphonenumber')} placeholder="+61 2 0000 0000" className={inputCls()} />
        </Field>
      </div>

      {/* Online */}
      <Field label="Website">
        <input {...register('website')} placeholder="https://company.com" className={inputCls()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Personal LinkedIn">
          <input {...register('personallinkedin')} placeholder="https://linkedin.com/in/..." className={inputCls()} />
        </Field>
        <Field label="Company LinkedIn">
          <input {...register('companylinkedin')} placeholder="https://linkedin.com/company/..." className={inputCls()} />
        </Field>
      </div>

      {/* Location */}
      <Field label="Address (full)">
        <input {...register('address')} placeholder="620 East Blvd Ste 550, Southlake, TX, United States" className={inputCls()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Street">
          <input {...register('street')} placeholder="620 East Boulevard" className={inputCls()} />
        </Field>
        <Field label="Postal Code">
          <input {...register('postalcode')} placeholder="94105" className={inputCls()} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input {...register('city')} placeholder="San Francisco" className={inputCls()} />
        </Field>
        <Field label="State">
          <input {...register('state')} placeholder="California" className={inputCls()} />
        </Field>
      </div>
      <Field label="Country">
        <select {...register('country')} className={selectCls()}>
          <option value="">Select country…</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      {/* CRM fields */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry">
          <select {...register('industry')} className={selectCls()}>
            <option value="">Select…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Seniority">
          <select {...register('seniority')} className={selectCls()}>
            <option value="">Select…</option>
            {['C-Level','VP','Director','Manager','Senior','Mid','Junior'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Department">
          <input {...register('department')} placeholder="Sales" className={inputCls()} />
        </Field>
        <Field label="Employee Size">
          <input {...register('employeesize')} type="number" min={0} placeholder="250" className={inputCls()} />
        </Field>
      </div>
      <Field label="Annual Revenue ($)">
        <input {...register('annualrevenue')} type="number" min={0} placeholder="5000000" className={inputCls()} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Email Status">
          <select {...register('emailcode')} className={selectCls()}>
            <option value="">Select…</option>
            {EMAIL_STATUSES.map(e => <option key={e.code} value={e.code}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Disposition">
          <select {...register('dispositioncode')} className={selectCls()}>
            <option value="">Select…</option>
            {DISPOSITION_CODES.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Provider">
          <select {...register('providercode')} className={selectCls()}>
            <option value="">Select…</option>
            {PROVIDERS.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Status">
        <select {...register('status')} className={selectCls()}>
          {['New','Contacted','Qualified','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Comments">
        <textarea {...register('comments')} rows={3} placeholder="Any notes about this prospect…"
          className={cn(inputCls(), 'h-auto py-2 resize-none')} />
      </Field>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" onClick={onCancel}
          className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isLoading}
          className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
          {isLoading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// Helper kept for backwards compatibility — prefer formToInsert in ProspectsPage
export function formValuesToProspect(data: ProspectFormValues, userId: string): Omit<Prospect, 'id'> {
  return {
    fullname:         `${data.firstname} ${data.lastname}`,
    firstname:        data.firstname,
    lastname:         data.lastname,
    jobtitle:         data.jobtitle ?? '',
    company:          data.company,
    website:          data.website ?? '',
    personallinkedin: data.personallinkedin ?? '',
    companylinkedin:  data.companylinkedin ?? '',
    altphonenumber:   data.altphonenumber ?? '0',
    companyphonenumber: data.companyphonenumber ?? '0',
    email:            data.email,
    emailcode:        (data.emailcode as Prospect['emailcode']) ?? 'EMA003',
    dispositioncode:  data.dispositioncode ?? 'DIS000',
    providercode:     data.providercode ?? 'PRV005',
    status:           data.status,
    country:          data.country ?? '',
    industry:         data.industry ?? '',
    employeesize:     data.employeesize ?? 0,
    annualrevenue:    data.annualrevenue ?? 0,
    createdon:        new Date().toISOString(),
    createdby:        userId,
    department:       data.department ?? '',
    seniority:        data.seniority ?? '',
    address:          data.address ?? '',
    street:           data.street ?? '',
    city:             data.city ?? '',
    state:            data.state ?? '',
    postalcode:       data.postalcode ?? '',
    comments:         data.comments ?? '',
    isactive:         true,
  }
}
