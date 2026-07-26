import React from 'react';
import { FiRefreshCw } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Centro app render failure:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error">
          <section>
            <span className="brand__mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <p className="eyebrow">Connection interrupted</p>
            <h1>The arrival board stopped updating.</h1>
            <p>
              Reload the app to reconnect. Centro’s official schedules remain
              available at centro.org.
            </p>
            <button
              className="button button--primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              <FiRefreshCw aria-hidden="true" />
              Reload app
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
