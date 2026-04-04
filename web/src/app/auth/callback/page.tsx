'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function OAuthCallbackContent() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'oauth_callback', token, error }, window.location.origin)
      window.close()
    } else {
      // Fallback: opened as full page redirect
      if (token) {
        localStorage.setItem('token', token)
        window.location.href = '/'
      } else {
        window.location.href = `/?oauth_error=${error || 'unknown'}`
      }
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600 text-sm">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallbackContent />
    </Suspense>
  )
}
