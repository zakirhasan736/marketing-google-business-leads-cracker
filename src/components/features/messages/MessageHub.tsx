"use client";

interface MessageHubProps {
  // placeholder for future integrations
}

export function MessageHub(_props: MessageHubProps) {
  const platforms = [
    "Email",
    "Facebook",
    "TikTok",
    "Twitter",
    "LinkedIn",
    "Instagram",
  ];

  return (
    <section className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
      <h2 className="text-2xl font-bold mb-6">Message Hub</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map((platform) => (
          <div
            key={platform}
            className="border border-neutral-200 p-6 rounded-xl"
          >
            <h3 className="font-bold text-lg mb-2">{platform}</h3>
            <p className="text-neutral-500 text-sm">
              No new messages from {platform}.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
