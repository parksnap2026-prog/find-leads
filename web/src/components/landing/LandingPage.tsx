import Link from "next/link";
import { ArrowRight, MapPin, Mail, Sparkles, Target, Zap } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { APP_TAGLINE } from "@/lib/constants";

const features = [
  {
    icon: Target,
    title: "Precision search",
    text: "Find local businesses by type, city, and country using OpenStreetMap or Google Places.",
  },
  {
    icon: Zap,
    title: "Instant enrichment",
    text: "Surface websites, phones, and emails so you can qualify leads before outreach.",
  },
  {
    icon: Mail,
    title: "Outreach ready",
    text: "Templates, compose tools, and activity tracking — built for teams who sell locally.",
  },
  {
    icon: MapPin,
    title: "Global coverage",
    text: "Search across 190+ countries with bundled city data for fast, reliable lookups.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f3ff] text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-violet-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/50 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/70 px-4 py-1.5 text-sm font-medium text-indigo-700 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Local lead generation, reimagined
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1e1b4b] sm:text-6xl">
              Turn local businesses into{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                qualified leads
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">{APP_TAGLINE}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 sm:w-auto"
              >
                Start for $25/month
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-6 py-3.5 text-base font-semibold text-slate-700 backdrop-blur transition hover:bg-white sm:w-auto"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl border border-white/70 bg-white/50 p-2 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Businesses found", value: "1,248" },
                  { label: "With websites", value: "892" },
                  { label: "Ready to contact", value: "634" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                  >
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="mt-1 text-sm text-indigo-200">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-indigo-200">
                  <span>Hair salons · London, UK</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
                    OpenStreetMap
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {["Bloom & Blade Studio", "The Cut Collective", "Luxe Hair Lounge"].map(
                    (name) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-white"
                      >
                        <span>{name}</span>
                        <span className="text-emerald-300">website ✓</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-white/60 bg-white/30 py-20 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b]">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-slate-600">
                One plan. Full access. Cancel anytime.
              </p>
            </div>
            <div className="mx-auto mt-12 max-w-lg">
              <div className="rounded-3xl border-2 border-indigo-200 bg-white/80 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
                <div className="text-center">
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Pro
                  </span>
                  <div className="mt-4 flex items-end justify-center gap-1">
                    <span className="text-5xl font-bold text-[#1e1b4b]">$25</span>
                    <span className="mb-2 text-slate-500">/month</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Billed monthly · no setup fees</p>
                </div>
                <ul className="mt-8 space-y-3 text-sm text-slate-700">
                  {[
                    "Unlimited business searches",
                    "Email scraper & website enrichment",
                    "Your own SMTP — send from your mail",
                    "Outreach templates you can edit",
                    "Personal activity & call logs",
                    "Export leads to CSV",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-700">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/60 bg-white/40 py-20 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b]">
                Everything you need to grow locally
              </h2>
              <p className="mt-4 text-slate-600">
                MBL gives your team a modern workspace to discover businesses, enrich
                contact data, and launch outreach — all in one place.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-4 inline-flex rounded-xl bg-indigo-100 p-3 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/60 bg-white/50 py-8 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo size="sm" showText />
          <p>© {new Date().getFullYear()} MyBusinessesLeads. Built for local growth.</p>
        </div>
      </footer>
    </div>
  );
}
