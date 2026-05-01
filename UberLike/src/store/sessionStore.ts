import { create } from 'zustand'
import type { UserRole } from '@/shared/types'

interface SessionState {
  role: UserRole
  userId: string
  userName: string
  setRole(r: UserRole): void
}

export const useSessionStore = create<SessionState>()((set) => ({
  role: (localStorage.getItem('rl_role') as UserRole) ?? 'rider',
  userId: 'user-1',
  userName: 'You',
  setRole(role) {
    localStorage.setItem('rl_role', role)
    set({ role })
  },
}))
