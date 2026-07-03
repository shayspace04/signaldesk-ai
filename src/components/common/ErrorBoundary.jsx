import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] rounded-2xl border border-dashed border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20 p-10">
          <p className="text-base font-medium text-red-700 dark:text-red-400">Something went wrong</p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-500 max-w-md text-center">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onRetry?.(); }}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
