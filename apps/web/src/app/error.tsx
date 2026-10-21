"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="shell public-main">
      <div className="state-card panel">
        <h1>Let’s try that again.</h1>
        <p>
          The page could not load. Your saved learning records remain on the
          server.
        </p>
        <button className="btn" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
