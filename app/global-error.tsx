"use client";

// Last resort, when even the app's frame fails. It replaces the root layout, so
// none of the app's styles load: everything here is inline and self-contained.

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b1529", color: "#f0f5fc", fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <title>{"Stow · We'll be right back"}</title>
        <main style={{ maxWidth: 420, background: "#13203a", borderRadius: 24, padding: 28 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>We can&apos;t load the app right now</h1>
          <p style={{ color: "#9aa6b8", fontSize: 14, lineHeight: 1.5 }}>
            Check your connection and try again. Your money is safe: nothing moves without the app signing it.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 8, background: "#4d7cff", color: "#fff", border: 0, borderRadius: 12, padding: "13px 22px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
