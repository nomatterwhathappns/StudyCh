import { TRPCError } from "@trpc/server";

export type SourceSearchScope = "web" | "academic";

export type SourceSearchResult = {
  id: string;
  scope: SourceSearchScope;
  title: string;
  url: string;
  summary: string;
  metadata: string;
};

type TavilyResult = { title?: unknown; url?: unknown; content?: unknown };
type OpenAlexWork = {
  id?: unknown;
  title?: unknown;
  publication_year?: unknown;
  doi?: unknown;
  primary_location?: { landing_page_url?: unknown } | null;
  authorships?: Array<{ author?: { display_name?: unknown } }>;
  abstract_inverted_index?: Record<string, number[]> | null;
};

const RESULT_LIMIT = 5;

function isPublicHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname) && url.hostname !== "localhost" && !url.hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function compactText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : text;
}

function openAlexAbstract(index: OpenAlexWork["abstract_inverted_index"]) {
  if (!index || typeof index !== "object") return "";
  const tokens: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    positions.forEach((position) => { if (Number.isInteger(position)) tokens.push([position, word]); });
  }
  return compactText(tokens.sort(([a], [b]) => a - b).map(([, word]) => word).join(" "), 260);
}

function openAlexAuthors(authorships: OpenAlexWork["authorships"]) {
  const names = (authorships ?? []).map((authorship) => typeof authorship.author?.display_name === "string" ? authorship.author.display_name.trim() : "").filter(Boolean);
  if (!names.length) return "Academic paper";
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

export function mapTavilyResults(items: TavilyResult[]): SourceSearchResult[] {
  return items.flatMap((item, index) => {
    if (!isPublicHttpUrl(item.url)) return [];
    const title = compactText(item.title, 180) || new URL(item.url).hostname.replace(/^www\./, "");
    return [{ id: `web-${index}-${item.url}`, scope: "web" as const, title, url: item.url, summary: compactText(item.content, 280) || "Open this result to review the source.", metadata: new URL(item.url).hostname.replace(/^www\./, "") }];
  }).slice(0, RESULT_LIMIT);
}

export function mapOpenAlexWorks(items: OpenAlexWork[]): SourceSearchResult[] {
  return items.flatMap((work, index) => {
    const landingPage = work.primary_location?.landing_page_url;
    const url = isPublicHttpUrl(landingPage) ? landingPage : isPublicHttpUrl(work.id) ? work.id : isPublicHttpUrl(work.doi) ? work.doi : "";
    if (!url) return [];
    const title = compactText(work.title, 180);
    if (!title) return [];
    const year = typeof work.publication_year === "number" ? String(work.publication_year) : "Year unavailable";
    return [{ id: `academic-${index}-${String(work.id ?? url)}`, scope: "academic" as const, title, url, summary: openAlexAbstract(work.abstract_inverted_index) || "Paper metadata is available. Open the source to review it.", metadata: `${openAlexAuthors(work.authorships)} · ${year}` }];
  }).slice(0, RESULT_LIMIT);
}

function toSearchError(response: Response, scope: SourceSearchScope) {
  if (response.status === 429) return new TRPCError({ code: "TOO_MANY_REQUESTS", message: scope === "web" ? "Kuota Search Web sementara habis. Coba lagi nanti." : "Pencarian Academic sedang sibuk. Coba lagi nanti." });
  if (response.status === 401 || response.status === 403) return new TRPCError({ code: "PRECONDITION_FAILED", message: "Search Web belum dikonfigurasi dengan benar. Periksa key Tavily di .env." });
  return new TRPCError({ code: "BAD_GATEWAY", message: "Search belum tersedia saat ini. Coba lagi beberapa saat lagi." });
}

async function searchWeb(query: string): Promise<SourceSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Search Web belum diatur. Tambahkan TAVILY_API_KEY ke .env terlebih dahulu." });
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: RESULT_LIMIT, include_answer: false, include_raw_content: false }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw toSearchError(response, "web");
  const payload = await response.json() as { results?: TavilyResult[] };
  return mapTavilyResults(Array.isArray(payload.results) ? payload.results : []);
}

async function searchAcademic(query: string): Promise<SourceSearchResult[]> {
  const params = new URLSearchParams({ search: query, "per-page": String(RESULT_LIMIT), select: "id,title,publication_year,doi,primary_location,authorships,abstract_inverted_index" });
  const response = await fetch(`https://api.openalex.org/works?${params}`, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json", "User-Agent": "StudyOS Source Search/1.0" } });
  if (!response.ok) throw toSearchError(response, "academic");
  const payload = await response.json() as { results?: OpenAlexWork[] };
  return mapOpenAlexWorks(Array.isArray(payload.results) ? payload.results : []);
}

export async function searchSources(scope: SourceSearchScope, query: string) {
  return scope === "web" ? searchWeb(query) : searchAcademic(query);
}
