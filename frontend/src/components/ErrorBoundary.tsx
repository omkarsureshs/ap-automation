import * as React from 'react'
import { ServerErrorPage } from '@/pages/ServerErrorPage'

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Unhandled error in AP Automation UI:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage />
    }
    return this.props.children
  }
}
