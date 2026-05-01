import { useState } from 'react'
import { CheckCircle2, Circle, MessageSquare } from 'lucide-react'
import { useComments, useUpdateComment, useCreateReply } from './useComments'
import { formatDistanceToNow } from '@/shared/utils/time'
import type { Comment } from '@/shared/types'

type CommentFilter = 'all' | 'open' | 'resolved'

interface CommentItemProps {
  comment: Comment
  fileId: string
}

function CommentItem({ comment, fileId }: CommentItemProps) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const { mutate: updateComment } = useUpdateComment(fileId)
  const { mutate: createReply, isPending } = useCreateReply(fileId)

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    createReply(
      { commentId: comment.id, input: { body: replyText.trim(), author: 'You' } },
      { onSuccess: () => { setReplyText(''); setShowReply(false) } }
    )
  }

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${
      comment.resolved ? 'border-border bg-white/[0.02]' : 'border-border bg-surface-300'
    }`}>
      <div className="flex items-start gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: comment.author === 'You' ? '#7c5cfc' : '#22d3ee' }}
        >
          {comment.author.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-white text-xs font-medium">{comment.author}</span>
            <span className="text-white/30 text-[10px]">{formatDistanceToNow(comment.createdAt)}</span>
          </div>
          <p className="text-white/70 text-xs leading-relaxed">{comment.body}</p>
        </div>
        <button
          onClick={() =>
            updateComment({ commentId: comment.id, input: { resolved: !comment.resolved } })
          }
          className={`shrink-0 transition-colors ${
            comment.resolved ? 'text-green-400 hover:text-green-300' : 'text-white/20 hover:text-white/60'
          }`}
          title={comment.resolved ? 'Mark as open' : 'Mark as resolved'}
        >
          {comment.resolved ? <CheckCircle2 size={14} /> : <Circle size={14} />}
        </button>
      </div>

      {/* Replies */}
      {comment.replies.map((r) => (
        <div key={r.id} className="flex gap-2 pl-8">
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/60 shrink-0">
            {r.author.charAt(0)}
          </div>
          <div>
            <span className="text-white/40 text-[10px] font-medium">{r.author} </span>
            <span className="text-white/60 text-xs">{r.body}</span>
          </div>
        </div>
      ))}

      {/* Reply toggle */}
      {!comment.resolved && (
        <div className="pl-8">
          {!showReply ? (
            <button
              onClick={() => setShowReply(true)}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              Reply
            </button>
          ) : (
            <form onSubmit={handleReply} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                autoFocus
                className="flex-1 bg-surface-400 border border-border focus:border-accent focus:outline-none text-white text-xs rounded px-2 py-1 placeholder:text-white/25"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isPending}
                className="text-accent text-xs disabled:opacity-40"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => setShowReply(false)}
                className="text-white/30 text-xs"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export function CommentsPanel({ fileId }: { fileId: string }) {
  const [filter, setFilter] = useState<CommentFilter>('open')
  const { data: comments, isPending } = useComments(fileId)

  const filtered = (comments ?? []).filter((c) => {
    if (filter === 'open') return !c.resolved
    if (filter === 'resolved') return c.resolved
    return true
  })

  const openCount = (comments ?? []).filter((c) => !c.resolved).length

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-white/40 font-medium uppercase tracking-wider mb-2">
          <MessageSquare size={11} />
          Comments
          {openCount > 0 && (
            <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[10px]">
              {openCount}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['all', 'open', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-accent/20 text-accent'
                  : 'text-white/30 hover:text-white/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isPending && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-300 rounded-lg animate-pulse" />
            ))}
          </div>
        )}
        {!isPending && filtered.length === 0 && (
          <p className="text-center text-white/20 text-xs py-8">
            {filter === 'open' ? 'No open comments' : 'No comments yet'}
          </p>
        )}
        {filtered.map((c) => (
          <CommentItem key={c.id} comment={c} fileId={fileId} />
        ))}
      </div>
    </div>
  )
}
