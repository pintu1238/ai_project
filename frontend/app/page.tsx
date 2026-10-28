import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300">ContentFlow AI</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">
          Turn podcasts and videos into platform-ready social campaigns — with human review built in.
        </h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Upload media, transcribe locally, detect high-value moments, generate Instagram / LinkedIn / X posts,
          design on-brand graphics, approve, schedule, and publish through connected accounts.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Start free
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5"
          >
            Sign in
          </Link>
          <Link href="/dashboard" className="rounded-full px-6 py-3 text-sm text-slate-300 hover:text-white">
            Open dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
