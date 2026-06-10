import type { Metadata } from "next";
import { renderMarkdownFile } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Material events affecting PunditBench scoring, data, or methodology.",
};

export default function ChangelogPage() {
  const html = renderMarkdownFile("CHANGELOG.md");
  return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
