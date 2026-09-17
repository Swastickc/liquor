import React from "react";
export default class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Store display failed:", error.name);
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-semibold">
          We couldn’t display the store
        </h1>
        <p className="my-4 text-sm">
          Please reload to try again. If you were completing a payment, check
          your order history before paying again.
        </p>
        <button
          className="rounded-lg bg-forest px-5 py-3 text-white"
          onClick={() => window.location.reload()}
        >
          Reload store
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
