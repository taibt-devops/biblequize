import React, { Component, ErrorInfo, ReactNode } from 'react'
import i18n from '../i18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error, errorInfo })
    
    // Log error to monitoring service
    this.logErrorToService(error, errorInfo)
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error monitoring service
    // like Sentry, LogRocket, or your own error tracking API
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch(console.error)
    } catch (e) {
      console.error('Failed to log error to service:', e)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      const t = i18n.t.bind(i18n)

      return (
        <div data-testid="error-boundary" className="min-h-screen flex items-center justify-center bg-bq-paper px-4 py-10">
          <div className="max-w-md w-full bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card p-8 text-center">
            {/* The traveller rests beside an unlit lantern: something stopped, nothing is lost (LKD-20) */}
            <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="h-40 mx-auto mb-5" />

            <h2 className="font-display text-2xl font-extrabold text-bq-ink mb-3">
              {t('components.errorBoundary.title')}
            </h2>

            <p className="font-read text-bq-ink2 mb-6">
              {t('components.errorBoundary.description')}
            </p>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm font-bold text-bq-ink2 hover:text-bq-ink mb-2">
                  {t('components.errorBoundary.detailsSummary')}
                </summary>
                <div className="bg-bq-parch border-2 border-bq-ink/20 rounded-xl p-4 text-xs text-bq-ink overflow-auto max-h-40">
                  <div className="mb-2">
                    <strong>{t('components.errorBoundary.errorLabel')}</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong>{t('components.errorBoundary.stackLabel')}</strong>
                    <pre className="whitespace-pre-wrap mt-1">{this.state.error.stack}</pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>{t('components.errorBoundary.componentStackLabel')}</strong>
                      <pre className="whitespace-pre-wrap mt-1">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                data-testid="error-boundary-retry-btn"
                onClick={this.handleRetry}
                className="lk-btn flex-1 text-bq-ink"
              >
                {t('components.errorBoundary.retryButton')}
              </button>
              <button
                onClick={this.handleReload}
                className="lk-btn lk-btn-2 flex-1 text-bq-ink"
              >
                {t('components.errorBoundary.reloadButton')}
              </button>
            </div>

            <p className="text-sm text-bq-ink3 mt-5">
              {t('components.errorBoundary.helpHint')}
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
