export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f3ff]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
      </div>
      <main className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
