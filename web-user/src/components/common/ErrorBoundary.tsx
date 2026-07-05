import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/primitives'

type Props = {
  children: ReactNode
  title?: string
}

type State = {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-lg font-semibold">{this.props.title ?? 'Không tải được trang'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.error.message || 'Đã xảy ra lỗi không mong muốn.'}
          </p>
          <Button
            className="mt-4"
            type="button"
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Tải lại trang
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
