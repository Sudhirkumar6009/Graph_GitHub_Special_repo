import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContributionDay {
  date: string; // "YYYY-MM-DD"
  contributionCount: number;
}

interface QueryParams {
  username: string;
  theme: string;
  bg_color?: string;
  line_color?: string;
  point_color?: string;
  area: boolean;
  hide_border: boolean;
  hide_title: boolean;
  custom_title?: string;
  height: number;
  days: number;
  radius: number;
}

// ─── Theme Definitions ────────────────────────────────────────────────────────
// Add new themes here — each key maps to a color palette.
// "default" is now a GitHub-dark inspired palette (cyan line on GitHub's dark bg).

const THEMES: Record<
  string,
  {
    bg: string;
    border: string;
    title: string;
    line: string;
    point: string;
    area: string;
    axis: string;
    grid: string;
  }
> = {
  default: {
    bg: "#0d1117",
    border: "#30363d",
    title: "#39d3d8",
    line: "#2dd4da",
    point: "#2dd4da",
    area: "rgba(45,212,218,0.15)",
    axis: "#8b949e",
    grid: "rgba(139,148,158,0.15)",
  },
  dark: {
    bg: "#0d1117",
    border: "#30363d",
    title: "#c9d1d9",
    line: "#6C63FF",
    point: "#6C63FF",
    area: "rgba(88,166,255,0.15)",
    axis: "#8b949e",
    grid: "rgba(139,148,158,0.15)",
  },
  radical: {
    bg: "#141321",
    border: "#fe428e",
    title: "#fe428e",
    line: "#fe428e",
    point: "#f8d847",
    area: "rgba(254,66,142,0.15)",
    axis: "#a9fef7",
    grid: "rgba(169,254,247,0.12)",
  },
  merko: {
    bg: "#0a0f0b",
    border: "#68b587",
    title: "#b7d364",
    line: "#68b587",
    point: "#b7d364",
    area: "rgba(104,181,135,0.15)",
    axis: "#68b587",
    grid: "rgba(104,181,135,0.12)",
  },
  gruvbox: {
    bg: "#282828",
    border: "#d65d0e",
    title: "#ebdbb2",
    line: "#fabd2f",
    point: "#fe8019",
    area: "rgba(250,189,47,0.15)",
    axis: "#a89984",
    grid: "rgba(168,153,132,0.15)",
  },
  tokyonight: {
    bg: "#1a1b27",
    border: "#414868",
    title: "#70a5fd",
    line: "#bf91f3",
    point: "#38bdae",
    area: "rgba(191,145,243,0.15)",
    axis: "#565f89",
    grid: "rgba(86,95,137,0.15)",
  },
  light: {
    bg: "#ffffff",
    border: "#e1e4e8",
    title: "#24292e",
    line: "#2188ff",
    point: "#2188ff",
    area: "rgba(33,136,255,0.15)",
    axis: "#959da5",
    grid: "rgba(149,157,165,0.25)",
  },
};

// ─── GitHub GraphQL Fetch ─────────────────────────────────────────────────────

async function fetchContributions(
  username: string,
  days: number,
): Promise<ContributionDay[]> {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN environment variable is not set.");

  // Calculate the date range: from (days-1) days ago up to today
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-activity-graph",
    },
    body: JSON.stringify({
      query,
      variables: {
        login: username,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as {
    data?: {
      user?: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: { contributionDays: ContributionDay[] }[];
          };
        };
      };
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(", "));
  }

  if (!json.data?.user) {
    throw new Error(`GitHub user "${username}" not found.`);
  }

  // Flatten weeks → days, sort by date, slice to requested range
  const allDays: ContributionDay[] =
    json.data.user.contributionsCollection.contributionCalendar.weeks
      .flatMap((w) => w.contributionDays)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days); // keep only the last `days` entries

  return allDays;
}

// ─── Smooth Path Helper ───────────────────────────────────────────────────────
// Converts a series of points into a smooth Catmull-Rom → cubic-bezier SVG path,
// instead of straight line segments between points.

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1)
    return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  return path;
}

// ─── SVG Renderer ─────────────────────────────────────────────────────────────

function renderSVG(days: ContributionDay[], params: QueryParams): string {
  const theme = THEMES[params.theme] ?? THEMES.default;

  // Allow per-param color overrides on top of the theme
  const bgColor = params.bg_color ?? theme.bg;
  const lineColor = params.line_color ?? theme.line;
  const pointColor = params.point_color ?? theme.point;
  const borderColor = theme.border;
  const titleColor = theme.title;
  const axisColor = theme.axis;
  const areaColor = theme.area;
  const gridColor = theme.grid;

  // ── Layout constants ──────────────────────────────────────────────────────
  const WIDTH = 800;
  const HEIGHT = params.height;
  const PADDING_TOP = params.hide_title ? 20 : 50; // room for title
  const PADDING_BOT = 40; // room for x-axis labels
  const PADDING_LEFT = 45; // room for y-axis labels
  const PADDING_RIGHT = 20;

  const chartW = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const chartH = HEIGHT - PADDING_TOP - PADDING_BOT;

  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  const maxCount = Math.max(...days.map((d) => d.contributionCount), 1);

  // ── Map each day to an (x, y) pixel coordinate ───────────────────────────
  const points = days.map((entry, i) => {
    const x = PADDING_LEFT + (i / Math.max(days.length - 1, 1)) * chartW;
    // Invert y: 0 contributions → bottom, maxCount → top
    const y =
      PADDING_TOP + chartH - (entry.contributionCount / maxCount) * chartH;
    return { x, y, entry };
  });

  // ── Build SVG path string (smooth curve through points) ──────────────────
  const linePath = buildSmoothPath(points);

  // Area fill: close the smooth path down to the baseline and back
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x.toFixed(2)},${(PADDING_TOP + chartH).toFixed(2)} L${points[0].x.toFixed(2)},${(PADDING_TOP + chartH).toFixed(2)} Z`
      : "";

  // ── Y-axis tick labels (0, mid, max) ─────────────────────────────────────
  const yTicks = [0, Math.round(maxCount / 2), maxCount];
  const yTickSVG = yTicks
    .map((val) => {
      const y = PADDING_TOP + chartH - (val / maxCount) * chartH;
      return `<text x="${(PADDING_LEFT - 6).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="${axisColor}">${val}</text>
<line x1="${PADDING_LEFT}" y1="${y.toFixed(2)}" x2="${(PADDING_LEFT + chartW).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${gridColor}" stroke-width="1"/>`;
    })
    .join("\n");

  // ── X-axis date labels (show ~5 evenly spaced dates) ─────────────────────
  const labelCount = Math.min(5, days.length);
  const xLabelSVG = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round(
      (i / Math.max(labelCount - 1, 1)) * (days.length - 1),
    );
    const p = points[idx];
    // Format date as "MMM D"
    const d = new Date(p.entry.date + "T00:00:00");
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `<text x="${p.x.toFixed(2)}" y="${(PADDING_TOP + chartH + 18).toFixed(2)}" text-anchor="middle" font-size="10" fill="${axisColor}">${label}</text>`;
  }).join("\n");

  // ── Data point circles ────────────────────────────────────────────────────
  // Only render circles when there are few enough points to avoid clutter
  const showDots = days.length <= 60;
  const dotsSVG = showDots
    ? points
        .map(
          (p) =>
            `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" fill="${pointColor}" />`,
        )
        .join("\n")
    : "";

  // ── Title text ────────────────────────────────────────────────────────────
  const titleText = params.custom_title
    ? params.custom_title
    : `${days[0]?.date ?? ""} – ${days[days.length - 1]?.date ?? ""}  •  ${total} contributions`;

  const titleSVG = params.hide_title
    ? ""
    : `<text x="${WIDTH / 2}" y="28" text-anchor="middle" font-size="14" font-weight="600" fill="${titleColor}" font-family="'Segoe UI',Ubuntu,sans-serif">${escapeXml(titleText)}</text>`;

  // ── Border ────────────────────────────────────────────────────────────────
  const borderSVG = params.hide_border
    ? ""
    : `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="${params.radius}" ry="${params.radius}" fill="none" stroke="${borderColor}" stroke-width="1"/>`;

  // ── Assemble final SVG ────────────────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <!-- Background card -->
  <rect width="${WIDTH}" height="${HEIGHT}" rx="${params.radius}" ry="${params.radius}" fill="${bgColor}"/>
  ${borderSVG}

  <!-- Y-axis grid lines and labels -->
  ${yTickSVG}

  <!-- X-axis date labels -->
  ${xLabelSVG}

  <!-- Area fill under the line (optional) -->
  ${params.area ? `<path d="${areaPath}" fill="${areaColor}" stroke="none"/>` : ""}

  <!-- Contribution line (smooth curve) -->
  <path d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>

  <!-- Data point dots -->
  ${dotsSVG}

  <!-- Title -->
  ${titleSVG}
</svg>`;
}

// ─── Error SVG ────────────────────────────────────────────────────────────────

function renderErrorSVG(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80" viewBox="0 0 400 80">
  <rect width="400" height="80" rx="8" fill="#fff0f0" stroke="#f97583" stroke-width="1"/>
  <text x="20" y="28" font-size="13" font-weight="600" fill="#d73a49" font-family="'Segoe UI',Ubuntu,sans-serif">GitHub Activity Graph — Error</text>
  <text x="20" y="52" font-size="11" fill="#586069" font-family="'Segoe UI',Ubuntu,sans-serif">${escapeXml(message)}</text>
</svg>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseBoolean(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined) return fallback;
  return val === "true" || val === "1";
}

function parseNumber(
  val: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(val);
  if (!val || isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ─── Vercel Handler ───────────────────────────────────────────────────────────

async function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string>;

  // Validate required param
  const username = q.username?.trim();
  if (!username) {
    res.setHeader("Content-Type", "image/svg+xml");
    return res
      .status(400)
      .send(renderErrorSVG("Missing required query param: username"));
  }

  // Parse all optional params with safe defaults
  const params: QueryParams = {
    username,
    theme: q.theme && THEMES[q.theme] ? q.theme : "default",
    bg_color: q.bg_color,
    line_color: q.line_color,
    point_color: q.point_color,
    area: parseBoolean(q.area, false),
    hide_border: parseBoolean(q.hide_border, false),
    hide_title: parseBoolean(q.hide_title, false),
    custom_title: q.custom_title,
    height: parseNumber(q.height, 200, 100, 600),
    days: parseNumber(q.days, 31, 7, 365),
    radius: parseNumber(q.radius, 8, 0, 30),
  };

  try {
    const contributions = await fetchContributions(username, params.days);
    const svg = renderSVG(contributions, params);

    // Cache for 30 minutes on CDN/browser — reduces GitHub API calls significantly
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
    res.setHeader("Content-Type", "image/svg+xml");
    return res.status(200).send(svg);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[graph] Error:", message);

    res.setHeader("Content-Type", "image/svg+xml");
    // Don't cache errors
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).send(renderErrorSVG(message));
  }
}
module.exports = handler;
