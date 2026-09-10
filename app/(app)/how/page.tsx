export default function HowItWorksPage() {
  const steps = [
    {
      icon: "1️⃣",
      title: "Report",
      desc: "Open BMU WATCH and select what you saw. You can submit anonymously or include your details."
    },
    {
      icon: "2️⃣",
      title: "Saved securely",
      desc: "Your report is stored safely on your device first, so it works even without internet."
    },
    {
      icon: "3️⃣",
      title: "Auto-sync",
      desc: "When your connection returns, your report is sent securely to the University Security Office."
    },
    {
      icon: "4️⃣",
      title: "Track & respond",
      desc: "Follow the status of your report in My Reports and read and reply to messages from the CSO."
    }
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">How BMU WATCH Works</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A simple, confidential way to report security concerns at Bayelsa Medical University.
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.title} className="card flex gap-3 p-4">
            <span className="text-2xl" aria-hidden>{s.icon}</span>
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{s.title}</h2>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Anonymous reporting:</strong> You can report without revealing who
        you are. Your identity is never shown to security personnel.
      </section>

      <section className="card p-4 text-sm text-gray-600 dark:text-gray-300">
        <h2 className="mb-1 font-bold text-gray-800 dark:text-gray-100">Privacy & your data</h2>
        <p>
          Reports are stored on your device so they work offline. Clearing your
          browser or app storage removes local copies; already-synced reports
          remain with the University Security Office. We only collect the
          information you choose to provide.
        </p>
      </section>
    </div>
  );
}
