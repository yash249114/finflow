import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LayoutClient from "./layout-client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read access_token cookie server-side
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    redirect("/login");
  }

  return <LayoutClient>{children}</LayoutClient>;
}
