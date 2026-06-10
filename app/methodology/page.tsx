import type { Metadata } from "next";
import { renderMarkdownFile } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How PunditBench collects, pre-registers and scores LLM predictions for the 2026 World Cup.",
};

export default function MethodologyPage() {
  const html = renderMarkdownFile("METHODOLOGY.md");
  return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
