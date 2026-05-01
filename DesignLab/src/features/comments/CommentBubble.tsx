import { useState } from 'react'
import { MessageSquare, CheckCircle } from 'lucide-react'
import type { Comment } from '@/shared/types'
import { formatDistanceToNow } from '@/shared/utils/time'
import { useUpdateComment, useCreateReply } from './useComments'

interface CommentBubbleProps {
  comment: Comment
  screenX: number
  screenY: number
  fileId: string
}

export function CommentBubble({ comment, screenX, screenY, fileId }: CommentBubbleProps) {
  const [open, setOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const { mutate: updateComment } = useUpdateComment(fileId)
  const { mutate: createReply, isPending } = useCreateReply(fileId)

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    createReply(
      { commentId: comment.id, input: { body: replyText.trim(), author: 'You' } },
      { onSuccess: () => setReplyText('') }
    )
  }

  return (
    <div
      className="absolute"
      style={{ left: screenX, top: screenY, transform: 'translate(-12px, -12px)', zIndex: 30 }}
    >
      {/* Bubble icon */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${
          comment.resolved
            ? 'bg-green-500/20 border border-green-500/40 text-green-400'
            : 'bg-accent border border-accent/60 text-white'
        }`}
      >
        {comment.resolved ? <CheckCircle size={13} /> : <MessageSquare size={12} />}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute left-8 top-0 bg-surface-200 border border-border rounded-lg shadow-2xl w-72 z-40"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                {comment.author.charAt(0)}
              </div>
              <span className="text-white text-xs font-medium">{comment.author}</span>
              <span className="text-white/30 text-[10px]">· {formatDistanceToNow(comment.createdAt)}</span>
            </div>
            <button
              onClick={() =>
                updateComment({ commentId: comment.id, input: { resolved: !comment.resolved } })
              }
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                comment.resolved
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-white/5 text-white/40 hover:text-white'
              }`}
            >
              {comment.resolved ? 'Resolved' : 'Resolve'}
            </button>
          </div>

          {/* Body */}
          <div className="px-3 py-2.5">
            <p className="text-white/80 text-xs leading-relaxed">{comment.body}</p>
          </div>

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="border-t border-border px-3 py-2 space-y-2">
              {comment.replies.map((r) => (
                <div key={r.id} className="flex gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/60 shrink-0 mt-0.5">
                    {r.author.charAt(0)}
                  </div>
                  <div>
                    <span className="text-white/50 text-[10px] font-medium">{r.author} </span>
                    <span className="text-white/70 text-xs">{r.body}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          {!comment.resolved && (
            <form onSubmit={handleReply} className="border-t border-border px-3 py-2.5 flex gap-2">
              <input
                type="text"
                placeholder="Reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-surface-300 border border-border focus:border-accent focus:outline-none text-white text-xs rounded px-2 py-1.5 placeholder:text-white/30"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isPending}
                className="text-accent text-xs font-medium disabled:opacity-40 hover:text-accent-light transition-colors"
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
