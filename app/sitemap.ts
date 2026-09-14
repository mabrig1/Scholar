import type { MetadataRoute } from "next";
import { getRepositorySitemapEntries } from "@/lib/open-repository-store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://scholar.mabrigkorie.org").replace(/\/$/, "");
  const paths = ["", "/workspace", "/research-agent", "/academic-indexing-agent", "/repository", "/humanizer", "/chapter-two", "/chapter-four", "/formatter", "/publishing-agent", "/free-journals", "/scopus-journals", "/academic-support", "/academic-printing", "/pricing", "/trust", "/privacy", "/terms", "/track"];

  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => ({
    url: base + path,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/repository" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/workspace" || path === "/repository" ? 0.9 : 0.7,
  }));

  const repository = await getRepositorySitemapEntries();
  const workEntries: MetadataRoute.Sitemap = repository.works.map((item) => ({
    url: base + "/repository/works/" + item.slug,
    lastModified: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.9,
  }));
  const researcherEntries: MetadataRoute.Sitemap = repository.researchers.map((item) => ({
    url: base + "/repository/researchers/" + item.slug,
    lastModified: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticEntries, ...workEntries, ...researcherEntries];
}
