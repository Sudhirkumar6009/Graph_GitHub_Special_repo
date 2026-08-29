# GitHub Activity Graph

A GitHub contribution activity graph rendered as an SVG image, served via a Vercel Serverless Function. Drop it into any README with a single `<img>` tag.

![Example](https://your-deployment.vercel.app/api/graph?username=torvalds&theme=dark&area=true)

---

## How it works

`GET /api/graph?username=<github_username>` fetches the user's daily contribution counts from GitHub's GraphQL API and returns a hand-crafted SVG line graph — no charting libraries, no frontend framework.

---

## Setup

### 1. Get a GitHub Personal Access Token (PAT)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token**
3. Give it a name (e.g. `activity-graph`)
4. Select the **`read:user`** scope (that's all that's needed for public contribution data)
5. Click **Generate token** and copy it

### 2. Deploy to Vercel

```bash
# Install dependencies
npm install

# Install Vercel CLI globally (if you haven't already)
npm i -g vercel

# Deploy
vercel
```

During the first deploy, Vercel will prompt you to link/create a project.

### 3. Add the environment variable

After deploying, add your token in the Vercel dashboard:

**Project → Settings → Environment Variables**

| Name | Value |
|------|-------|
| `GH_TOKEN` | `your_github_personal_access_token` |

Or via CLI:
```bash
vercel env add GH_TOKEN
```

Then redeploy:
```bash
vercel --prod
```

### 4. Local development

```bash
cp .env.example .env
# Edit .env and paste your real GH_TOKEN

npm run dev   # starts vercel dev on http://localhost:3000
```

Visit: `http://localhost:3000/api/graph?username=your_github_username`

---

## Usage

Paste this into any GitHub README:

```markdown
![Activity Graph](https://your-deployment.vercel.app/api/graph?username=YOUR_USERNAME)
```

Or as HTML for more control:

```html
<img src="https://your-deployment.vercel.app/api/graph?username=YOUR_USERNAME&theme=dark&area=true" alt="GitHub Activity Graph" />
```

---

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `username` | string | **required** | GitHub username |
| `theme` | string | `default` | Color theme (see below) |
| `days` | number | `31` | Number of days to show (7–365) |
| `height` | number | `200` | SVG height in px (100–600) |
| `area` | boolean | `false` | Fill area under the line |
| `hide_border` | boolean | `false` | Hide the card border |
| `hide_title` | boolean | `false` | Hide the title bar |
| `custom_title` | string | — | Override the auto-generated title |
| `radius` | number | `8` | Card corner radius (0–30) |
| `bg_color` | string | — | Override background color (e.g. `%23fff`) |
| `line_color` | string | — | Override line color |
| `point_color` | string | — | Override dot color |

> **Note:** Pass hex colors URL-encoded — `#2188ff` becomes `%232188ff`

---

## Themes

| Theme | Preview URL |
|-------|-------------|
| `default` | `?theme=default` |
| `dark` | `?theme=dark` |
| `radical` | `?theme=radical` |
| `merko` | `?theme=merko` |
| `gruvbox` | `?theme=gruvbox` |
| `tokyonight` | `?theme=tokyonight` |

### Adding a new theme

Open `api/graph.ts` and add an entry to the `THEMES` object:

```ts
mytheme: {
  bg: "#1e1e2e",
  border: "#cba6f7",
  title: "#cdd6f4",
  line: "#cba6f7",
  point: "#f38ba8",
  area: "rgba(203,166,247,0.15)",
  axis: "#6c7086",
},
```

Then use it with `?theme=mytheme`.

---

## Caching

Responses are cached for **30 minutes** (`Cache-Control: public, max-age=1800`). This keeps GitHub API usage well within rate limits even if your README is viewed frequently.

---

## Project Structure

```
├── api/
│   └── graph.ts        # Serverless function: fetches data + renders SVG
├── .env.example        # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```
