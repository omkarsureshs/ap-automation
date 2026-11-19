import * as React from 'react'
import { Button } from '@/components/ui/button'

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
      return (
        <div className="mx-auto mt-24 max-w-sm px-4 text-center">
          <h1 className="mb-1 text-base font-semibold">Something went wrong loading this page.</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Your work on other pages is safe. Reloading usually fixes this.
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
