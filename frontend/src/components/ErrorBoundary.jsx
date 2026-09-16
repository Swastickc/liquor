import React from "react";

// 🛡️ CRASH FIX: With no Error Boundary anywhere in the app, any uncaught
// render/import error (e.g. the Firebase "auth/invalid-api-key" crash on
// /login and /register) unmounted the ENTIRE React tree, leaving a blank
// white page with no way to recover except a hard refresh. This boundary
// catches such errors locally and shows a friendly, recoverable screen
// instead, while logging the real error to the console for diagnosis.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled UI error caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-black text-white px-4">
          <div className="max-w-md w-full text-center bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
            <h1 className="text-2xl font-extrabold mb-2">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              This page hit an unexpected error. You can go back to the homepage and try again.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full bg-primary hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
