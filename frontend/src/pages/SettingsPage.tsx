import { useEffect, useState } from 'react'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SkeletonRow } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableHeaderRow, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
  ApiError,
  type ApprovalRule,
  createApprovalRule,
  deleteApprovalRule,
  getCurrentUser,
  listApprovalRules,
  listUsers,
  type ManagedUser,
  updateApprovalRule,
  updateUser,
} from '@/lib/api'
import { APPROVER_CAPABLE_ROLES, ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/nav'

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'forbidden') return "You don't have access to this page. That's limited to AP Admins."
    return err.message
  }
  return 'Something went wrong. Try again.'
}

function UsersSection() {
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const { show } = useToast()
  const myId = getCurrentUser()?.id

  async function refresh() {
    try {
      setUsers(await listUsers())
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessageFor(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleRoleChange(user: ManagedUser, role: string) {
    setBusyId(user.id)
    try {
      await updateUser(user.id, { role })
      show({ title: 'Role updated', description: `${user.email} is now ${ROLE_LABELS[role] ?? role}`, variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't update role", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(user: ManagedUser) {
    setBusyId(user.id)
    try {
      await updateUser(user.id, { is_active: !user.is_active })
      show({
        title: user.is_active ? 'Account deactivated' : 'Account reactivated',
        description: user.email,
        variant: 'success',
      })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't update account", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  if (loadError) {
    return (
      <Banner
        variant="error"
        title="Couldn't load users."
        action={
          <Button type="button" onClick={refresh}>
            Try again
          </Button>
        }
      >
        {loadError}
      </Banner>
    )
  }

  return (
    <Table>
      <TableHead>
        <TableHeaderRow>
          <TableHeaderCell>Email</TableHeaderCell>
          <TableHeaderCell>Role</TableHeaderCell>
          <TableHeaderCell>Active</TableHeaderCell>
        </TableHeaderRow>
      </TableHead>
      <TableBody>
        {users === null ? (
          <>
            <SkeletonRow columns={3} />
            <SkeletonRow columns={3} />
          </>
        ) : (
          users.map((user) => {
            const isSelf = user.id === myId
            return (
              <TableRow key={user.id}>
                <TableCell>
                  {user.email}
                  {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </TableCell>
                <TableCell>
                  <select
                    value={user.role}
                    disabled={isSelf || busyId === user.id}
                    onChange={(e) => handleRoleChange(user, e.target.value)}
                    className="rounded-md border border-hairline bg-background px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    disabled={isSelf || busyId === user.id}
                    onClick={() => handleToggleActive(user)}
                    className="text-xs font-medium text-primary underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
                  >
                    {user.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

const EMPTY_RULE_FORM = { min_amount: '', max_amount: '', approver_roles: ['approver'] as string[], escalation_hours: '24' }

function ApprovalRulesSection() {
  const [rules, setRules] = useState<ApprovalRule[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState(EMPTY_RULE_FORM)
  const { show } = useToast()

  async function refresh() {
    try {
      setRules(await listApprovalRules())
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessageFor(err))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function toggleFormRole(role: string) {
    setForm((f) => ({
      ...f,
      approver_roles: f.approver_roles.includes(role)
        ? f.approver_roles.filter((r) => r !== role)
        : [...f.approver_roles, role],
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setFieldErrors({})
    try {
      await createApprovalRule({
        min_amount: form.min_amount,
        max_amount: form.max_amount,
        approver_roles: form.approver_roles,
        escalation_hours: Number(form.escalation_hours),
        is_active: true,
      })
      show({ title: 'Approval rule added', variant: 'success' })
      setForm(EMPTY_RULE_FORM)
      await refresh()
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'validation') setFieldErrors(err.fieldErrors ?? {})
      show({ title: "Couldn't add rule", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(rule: ApprovalRule) {
    setBusyId(rule.id)
    try {
      await updateApprovalRule(rule.id, { is_active: !rule.is_active })
      show({ title: rule.is_active ? 'Rule deactivated' : 'Rule reactivated', variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't update rule", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(rule: ApprovalRule) {
    if (!window.confirm('Delete this approval rule? This can\'t be undone.')) return
    setBusyId(rule.id)
    try {
      await deleteApprovalRule(rule.id)
      show({ title: 'Rule deleted', variant: 'success' })
      await refresh()
    } catch (err) {
      show({ title: "Couldn't delete rule", description: errorMessageFor(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-md border border-hairline p-4 sm:flex-row sm:flex-wrap sm:items-start"
      >
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Min amount"
            value={form.min_amount}
            onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
            invalid={Boolean(fieldErrors.min_amount)}
            required
          />
          {fieldErrors.min_amount && <span className="text-xs text-exception">{fieldErrors.min_amount}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Max amount"
            value={form.max_amount}
            onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
            invalid={Boolean(fieldErrors.max_amount)}
            required
          />
          {fieldErrors.max_amount && <span className="text-xs text-exception">{fieldErrors.max_amount}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Escalation hours"
            type="number"
            min="1"
            value={form.escalation_hours}
            onChange={(e) => setForm({ ...form, escalation_hours: e.target.value })}
            invalid={Boolean(fieldErrors.escalation_hours)}
            required
          />
          {fieldErrors.escalation_hours && (
            <span className="text-xs text-exception">{fieldErrors.escalation_hours}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Approver role(s)</span>
          <div className="flex gap-3">
            {APPROVER_CAPABLE_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={form.approver_roles.includes(role)}
                  onChange={() => toggleFormRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
          {fieldErrors.approver_roles && <span className="text-xs text-exception">{fieldErrors.approver_roles}</span>}
        </div>
        <Button type="submit" loading={submitting}>
          Add rule
        </Button>
      </form>

      {loadError ? (
        <Banner
          variant="error"
          title="Couldn't load approval rules."
          action={
            <Button type="button" onClick={refresh}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Banner>
      ) : (
        <Table>
          <TableHead>
            <TableHeaderRow>
              <TableHeaderCell>Amount range</TableHeaderCell>
              <TableHeaderCell>Approver role(s)</TableHeaderCell>
              <TableHeaderCell>Escalation</TableHeaderCell>
              <TableHeaderCell>Active</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableHeaderRow>
          </TableHead>
          <TableBody>
            {rules === null ? (
              <>
                <SkeletonRow columns={5} />
                <SkeletonRow columns={5} />
              </>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="tabular">
                    ₹{rule.min_amount} – ₹{rule.max_amount}
                  </TableCell>
                  <TableCell>{rule.approver_roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}</TableCell>
                  <TableCell>{rule.escalation_hours}h</TableCell>
                  <TableCell>{rule.is_active ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={busyId === rule.id}
                        onClick={() => handleToggleActive(rule)}
                        className="text-xs font-medium text-primary underline underline-offset-2 disabled:opacity-50"
                      >
                        {rule.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rule.id}
                        onClick={() => handleDelete(rule)}
                        className="text-xs font-medium text-exception underline underline-offset-2 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export function SettingsPage() {
  const isAdmin = getCurrentUser()?.role === 'ap_admin'

  if (!isAdmin) {
    return (
      <Banner variant="error" title="You don't have access to this page.">
        Settings are limited to AP Admins.
      </Banner>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who has access to what, and the amount thresholds that drive approval routing.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Users &amp; roles</h2>
        <UsersSection />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Approval rules</h2>
        <p className="text-xs text-muted-foreground">
          An invoice's amount picks the first active rule whose range it falls in. Ranges don't have to
          be contiguous — an amount with no covering rule lands in Needs Review rather than being
          silently approved.
        </p>
        <ApprovalRulesSection />
      </section>
    </div>
  )
}
