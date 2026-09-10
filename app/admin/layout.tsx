import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Security Operations · BMU WATCH",
    template: "%s · BMU WATCH"
  }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
