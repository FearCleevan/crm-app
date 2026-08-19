import { useState, useRef } from 'react'
import { Camera, Save, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { usersService } from '@/services/users.service'
import { storageService } from '@/services/storage.service'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { UnsavedChangesGuard } from '@/components/ui/UnsavedChangesGuard'

const inputCls = (err?: boolean) => cn(
  'w-full h-9 rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
  err ? 'border-rose-500' : 'border-input hover:border-muted-foreground',
)

function Field({ label, id, children, error }: { label: string; id: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</label>
      {children}
      {error && <p className="text-[11px] text-rose-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  )
}

export function ProfileTab() {
  const { user, updateUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [firstName,    setFirstName]    = useState(user?.first_name ?? '')
  const [lastName,     setLastName]     = useState(user?.last_name ?? '')
  const [email,        setEmail]        = useState(user?.email ?? '')
  const [phone,        setPhone]        = useState(user?.phone_no ?? '')
  const [department,   setDepartment]   = useState(user?.department ?? '')
  const [address,      setAddress]      = useState(user?.address ?? '')
  const [birthday,     setBirthday]     = useState(user?.birthday ?? '')
  const [avatarSrc,    setAvatarSrc]    = useState(user?.profile_url ?? '')
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null)
  const [profileDirty, setProfileDirty] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCur,   setShowCur]   = useState(false)
  const [showNew,   setShowNew]   = useState(false)
  const [showCon,   setShowCon]   = useState(false)
  const [pwError,   setPwError]   = useState('')
  const [pwSaving,  setPwSaving]  = useState(false)

  const blocker = useUnsavedChanges(profileDirty)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarSrc(String(ev.target?.result ?? ''))
    reader.readAsDataURL(file)
    setProfileDirty(true)
  }

  async function saveProfile() {
    if (!user?.id) return
    setProfileSaving(true)
    try {
      let profileUrl = user.profile_url ?? ''

      if (avatarFile) {
        profileUrl = await storageService.uploadAvatar(avatarFile)
        setAvatarFile(null)
      }

      await usersService.updateUser(user.id, {
        first_name:  firstName,
        last_name:   lastName,
        email:       email,
        phone_no:    phone      || null,
        department:  department || null,
        profile_url: profileUrl || null,
        address:     address    || null,
        birthday:    birthday   || null,
      })

      updateUser({
        first_name:  firstName,
        last_name:   lastName,
        email,
        phone_no:    phone,
        department,
        profile_url: profileUrl,
        address,
        birthday,
      })

      toast.success('Profile updated successfully')
      setProfileDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  async function savePassword() {
    setPwError('')
    if (!currentPw) { setPwError('Current password is required'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }

    setPwSaving(true)
    try {
      // Re-authenticate with current password to verify it before changing
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) throw new Error('No active session')

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    session.user.email,
        password: currentPw,
      })
      if (signInErr) throw new Error('Current password is incorrect')

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
      if (updateErr) throw new Error(updateErr.message)

      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`

  return (
    <>
      <div className="max-w-2xl space-y-8">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl font-bold text-brand-700 dark:text-brand-300 border-2 border-border">
                {initials}
              </div>
            )}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
              aria-label="Upload profile photo">
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload profile photo"
              tabIndex={-1}
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role}</p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-brand-500 hover:text-brand-600 mt-1.5 transition-colors">
              Change photo
            </button>
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" id="profile-first-name">
              <input id="profile-first-name" value={firstName}
                onChange={e => { setFirstName(e.target.value); setProfileDirty(true) }}
                placeholder="First name"
                className={inputCls()} />
            </Field>
            <Field label="Last Name" id="profile-last-name">
              <input id="profile-last-name" value={lastName}
                onChange={e => { setLastName(e.target.value); setProfileDirty(true) }}
                placeholder="Last name"
                className={inputCls()} />
            </Field>
          </div>
          <Field label="Email" id="profile-email">
            <input id="profile-email" type="email" value={email}
              onChange={e => { setEmail(e.target.value); setProfileDirty(true) }}
              placeholder="you@example.com"
              className={inputCls()} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone Number" id="profile-phone">
              <input id="profile-phone" value={phone}
                onChange={e => { setPhone(e.target.value); setProfileDirty(true) }}
                placeholder="+61 400 000 000"
                className={inputCls()} />
            </Field>
            <Field label="Department" id="profile-department">
              <input id="profile-department" value={department}
                onChange={e => { setDepartment(e.target.value); setProfileDirty(true) }}
                placeholder="Sales"
                className={inputCls()} />
            </Field>
          </div>
          <Field label="Address" id="profile-address">
            <input id="profile-address" value={address}
              onChange={e => { setAddress(e.target.value); setProfileDirty(true) }}
              placeholder="123 Main St, Sydney NSW"
              className={inputCls()} />
          </Field>
          <Field label="Birthday" id="profile-birthday">
            <input id="profile-birthday" type="date" value={birthday}
              title="Date of birth"
              onChange={e => { setBirthday(e.target.value); setProfileDirty(true) }}
              className={inputCls()} />
          </Field>
          <div className="flex justify-end pt-1">
            <button type="button" onClick={saveProfile} disabled={!profileDirty || profileSaving}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Save className="h-3.5 w-3.5" />
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Change Password</h3>

          {[
            { id: 'pw-current', label: 'Current Password', value: currentPw, set: setCurrentPw, show: showCur, toggleShow: () => setShowCur(v => !v) },
            { id: 'pw-new',     label: 'New Password',     value: newPw,     set: setNewPw,     show: showNew, toggleShow: () => setShowNew(v => !v) },
            { id: 'pw-confirm', label: 'Confirm Password', value: confirmPw, set: setConfirmPw, show: showCon, toggleShow: () => setShowCon(v => !v) },
          ].map(({ id, label, value, set, show, toggleShow }) => (
            <div key={id} className="space-y-1.5">
              <label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</label>
              <div className="relative">
                <input id={id} type={show ? 'text' : 'password'} value={value}
                  onChange={e => { set(e.target.value); setPwError('') }}
                  placeholder="••••••••"
                  className={cn(inputCls(), 'pr-9')} />
                <button type="button" onClick={toggleShow}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}

          {pwError && (
            <p className="text-[11px] text-rose-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />{pwError}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button type="button" onClick={savePassword} disabled={pwSaving}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              <Save className="h-3.5 w-3.5" />
              {pwSaving ? 'Saving…' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      <UnsavedChangesGuard blocker={blocker} />
    </>
  )
}
