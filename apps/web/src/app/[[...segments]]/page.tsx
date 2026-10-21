import { Experience } from "@/components/experience";
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <Experience route={"/" + (segments || []).join("/")} />;
}
