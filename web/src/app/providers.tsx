'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

function AuthInit() {
  const { initAuth } = useAuthStore()
  useEffect(() => {
    initAuth()
  }, [])
  return null
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 0, retry: 1 } },
  }))

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
      <QueryClientProvider client={queryClient}>
        <AuthInit />
        {children}
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
