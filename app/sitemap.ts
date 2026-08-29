import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://scholar.mabrigkorie.org").replace(/\/$/, "");
  const paths = ["", "/workspace", "/chapter-two", "/chapter-four", "/formatter", "/publishing-agent", "/free-journals", "/scopus-journals", "/academic-support", "/academic-printing", "/pricing", "/trust", "/privacy", "/terms", "/track"];
  return paths.map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/workspace" ? 0.9 : 0.7 }));
}
