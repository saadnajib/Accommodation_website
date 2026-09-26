import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, FileText, Info, Lock, MessageSquare, Phone, SendHorizontal } from 'lucide-react'
import type { Application, Listing, Message, User } from '@/types'
import { Avatar, Button, EmptyState, PageHeader } from '@/components/ui'
import { useCurrentUser, useStore } from '@/store/useStore'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { formatTime } from '@/components/shared/applicationUtils'

interface Conversation {
  app: Application
  listing?: Listing
  renter?: User
  owner?: User
  /** The other party from the viewer's point of view (undefined for admin). */
  counterpart?: User
  last?: Message
  lastAt: string
  unlockedAt: string
}

function applicationLink(role: User['role'], id: string) {
  if (role === 'owner') return `/owner/applications/${id}`
  if (role === 'admin') return `/admin/applications/${id}`
  return `/dashboard/applications/${id}`
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MessagesPage() {
  const { applicationId } = useParams()
  const user = useCurrentUser()
  const applications = useStore((s) => s.applications)
  const messages = useStore((s) => s.messages)
  const users = useStore((s) => s.users)
  const listings = useStore((s) => s.listings)
  const nav = useNavigate()
  const [picked, setPicked] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(applicationId ? 'thread' : 'list')

  const conversations = useMemo<Conversation[]>(() => {
    if (!user) return []
    const isAdmin = user.role === 'admin'
    return applications
      .filter((a) => a.contactUnlocked && (isAdmin || a.renterId === user.id || a.ownerId === user.id))
      .map((a) => {
        const thread = messages.filter((m) => m.applicationId === a.id)
        const last = thread.reduce<Message | undefined>((acc, m) => (!acc || m.at > acc.at ? m : acc), undefined)
        const renter = users.find((u) => u.id === a.renterId)
        const owner = users.find((u) => u.id === a.ownerId)
        const unlockedAt = [...a.timeline].reverse().find((e) => e.status === 'contact_unlocked')?.at ?? a.createdAt
        return {
          app: a, listing: listings.find((l) => l.id === a.listingId), renter, owner,
          counterpart: isAdmin ? undefined : a.renterId === user.id ? owner : renter,
          last, lastAt: last?.at ?? unlockedAt, unlockedAt,
        }
      })
      .sort((x, y) => y.lastAt.localeCompare(x.lastAt))
  }, [applications, messages, users, listings, user])

  if (!user) return null

  const paramValid = !!applicationId && conversations.some((c) => c.app.id === applicationId)
  const activeId = paramValid ? applicationId : picked && conversations.some((c) => c.app.id === picked) ? picked : conversations[0]?.app.id
  const active = conversations.find((c) => c.app.id === activeId)
  const isAdmin = user.role === 'admin'

  const select = (id: string) => {
    setMobileView('thread')
    if (applicationId) nav(`/messages/${id}`, { replace: true })
    else setPicked(id)
  }

  const emptyAction = user.role === 'owner'
    ? <Link to="/owner/applicants"><Button>View applicants</Button></Link>
    : isAdmin ? <Link to="/admin/applications"><Button>Open deal pipeline</Button></Link>
      : <Link to="/dashboard/applications"><Button>View my applications</Button></Link>

  return (
    <div className={applicationId ? 'container-x py-6 sm:py-8' : undefined}>
      {applicationId && (
        <Link to={applicationLink(user.role, applicationId)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Back to application
        </Link>
      )}
      <PageHeader title="Messages"
        description={isAdmin ? 'All unlocked conversations between renters and owners.' : 'Chat directly once contact is unlocked.'} />

      {isAdmin && conversations.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" /> Admin view is read-only. Use it to resolve disputes — renters and owners can’t see that you’ve viewed their messages.
        </p>
      )}
      {applicationId && !paramValid && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> That conversation isn’t available yet. Messaging unlocks after the owner accepts and both service fees are paid.
        </p>
      )}

      {conversations.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="No conversations yet"
          description="Messaging unlocks once the owner accepts an application and both sides have paid their service fee. Until then, StayBridge handles all communication to keep everyone safe."
          action={emptyAction} />
      ) : (
        <div className="flex h-[calc(100dvh-15rem)] min-h-[460px] overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card">
          {/* Conversation list */}
          <div className={cn('w-full shrink-0 flex-col border-ink-100 md:flex md:w-72 md:border-r lg:w-80', mobileView === 'thread' ? 'hidden' : 'flex')}>
            <div className="border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Conversations <span className="ml-1 text-ink-400">{conversations.length}</span></p>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {conversations.map((c) => {
                const title = isAdmin ? `${c.renter?.name ?? 'Renter'} ↔ ${c.owner?.name ?? 'Owner'}` : c.counterpart?.name ?? 'StayBridge member'
                const preview = c.last ? `${c.last.fromId === user.id ? 'You: ' : ''}${c.last.text}` : 'Contact unlocked — say hello!'
                const selected = c.app.id === activeId
                return (
                  <li key={c.app.id}>
                    <button onClick={() => select(c.app.id)} aria-current={selected ? 'true' : undefined}
                      className={cn('flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors',
                        selected ? 'bg-brand-50' : 'hover:bg-ink-50')}>
                      <Avatar name={isAdmin ? c.renter?.name ?? '?' : c.counterpart?.name ?? '?'} src={isAdmin ? c.renter?.avatarUrl : c.counterpart?.avatarUrl} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-sm font-semibold', selected ? 'text-brand-900' : 'text-ink-900')}>{title}</span>
                          <span className="shrink-0 text-[11px] text-ink-400">{timeAgo(c.lastAt)}</span>
                        </span>
                        <span className="block truncate text-xs font-medium text-ink-500">{c.listing?.title ?? 'Listing'}</span>
                        <span className={cn('block truncate text-xs', c.last ? 'text-ink-400' : 'italic text-brand-700')}>{preview}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Thread */}
          <div className={cn('min-w-0 flex-1 flex-col md:flex', mobileView === 'list' ? 'hidden' : 'flex')}>
            {active ? (
              <Thread key={active.app.id} convo={active} me={user} onBack={() => setMobileView('list')} />
            ) : (
              <div className="grid flex-1 place-items-center p-6 text-sm text-ink-400">Select a conversation</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Thread({ convo, me, onBack }: { convo: Conversation; me: User; onBack: () => void }) {
  const all = useStore((s) => s.messages)
  const sendMessage = useStore((s) => s.sendMessage)
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isAdmin = me.role === 'admin'
  const thread = useMemo(() => all.filter((m) => m.applicationId === convo.app.id).sort((a, b) => a.at.localeCompare(b.at)), [all, convo.app.id])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.length])

  const send = () => {
    if (!text.trim()) return
    sendMessage(convo.app.id, text)
    setText('')
    inputRef.current?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const other = convo.counterpart
  const headerName = isAdmin ? `${convo.renter?.name ?? 'Renter'} ↔ ${convo.owner?.name ?? 'Owner'}` : other?.name ?? 'StayBridge member'
  const nameOf = (id: string) => users(convo).find((u) => u.id === id)?.name ?? 'Member'
  // For admins, the owner's messages go on the right so the two sides are visually distinct.
  const isRight = (m: Message) => (isAdmin ? m.fromId === convo.app.ownerId : m.fromId === me.id)

  return (
    <>
      <div className="flex items-center gap-3 border-b border-ink-100 px-3 py-3 sm:px-4">
        <button onClick={onBack} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={isAdmin ? convo.renter?.name ?? '?' : other?.name ?? '?'} src={isAdmin ? convo.renter?.avatarUrl : other?.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{headerName}</p>
          {convo.listing ? (
            <Link to={`/listings/${convo.listing.id}`} className="block truncate text-xs text-ink-500 hover:text-brand-700 hover:underline">{convo.listing.title}</Link>
          ) : <p className="text-xs text-ink-400">Listing</p>}
        </div>
        {!isAdmin && other?.phone && (
          <a href={`tel:${other.phone.replace(/\s/g, '')}`} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-100 sm:inline-flex" title={other.phone}>
            <Phone className="h-4 w-4" /> Call
          </a>
        )}
        <Link to={applicationLink(me.role, convo.app.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50" aria-label="View application">
          <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Application</span>
        </Link>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-ink-50/60 px-3 py-4 sm:px-5" aria-live="polite">
        <p className="mx-auto mb-4 flex max-w-sm items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs text-ink-500 shadow-sm ring-1 ring-ink-100">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          Contact unlocked {formatDate(convo.unlockedAt)}.
          {convo.listing ? ` Address: ${convo.listing.address}.` : ''} Keep payments for rent and deposit to your signed contract.
        </p>
        {thread.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-400">{isAdmin ? 'No messages exchanged yet.' : 'No messages yet. Say hello and arrange a viewing.'}</p>
        )}
        {thread.map((m, i) => {
          const prev = thread[i - 1]
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString()
          const grouped = !!prev && !newDay && prev.fromId === m.fromId
          const right = isRight(m)
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1 bg-ink-200" />
                  <span className="text-[11px] font-medium text-ink-400">{dayLabel(m.at)}</span>
                  <span className="h-px flex-1 bg-ink-200" />
                </div>
              )}
              <div className={cn('flex', right ? 'justify-end' : 'justify-start', grouped ? 'mt-0.5' : 'mt-2')}>
                <div className={cn('max-w-[85%] sm:max-w-[70%]')}>
                  {isAdmin && !grouped && <p className={cn('mb-0.5 px-1 text-[11px] font-medium text-ink-400', right && 'text-right')}>{nameOf(m.fromId)}</p>}
                  <div className={cn('whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                    right ? 'rounded-br-md bg-brand-700 text-white' : 'rounded-bl-md bg-white text-ink-800 ring-1 ring-ink-100')}>
                    {m.text}
                  </div>
                  <p className={cn('mt-0.5 px-1 text-[10px] text-ink-400', right && 'text-right')}>
                    <time dateTime={m.at}>{formatTime(m.at)}</time>
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {isAdmin ? (
        <div className="flex items-center gap-2 border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
          <Lock className="h-4 w-4 shrink-0" /> Read-only — admins can view but not send messages in this conversation.
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-end gap-2 border-t border-ink-100 p-3">
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea id="composer" ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
            placeholder={`Message ${other?.name.split(' ')[0] ?? ''}…`}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25" />
          <Button type="submit" disabled={!text.trim()} aria-label="Send message" className="h-11 w-11 shrink-0 px-0!">
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      )}
      {!isAdmin && <p className="hidden px-4 pb-2 text-[11px] text-ink-400 sm:block">Enter to send · Shift + Enter for a new line</p>}
    </>
  )
}

function users(c: Conversation) {
  return [c.renter, c.owner].filter((u): u is User => !!u)
}
