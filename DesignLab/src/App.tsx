import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '@/features/files/Dashboard'
import { Editor } from '@/features/editor/Editor'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 404
        if (error instanceof Error && error.message.startsWith('404')) return false
        return failureCount < 2
      },
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:fileId" element={<Editor />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
