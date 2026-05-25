# Geargen

Web-based woodworking calculators and tools, inspired by [woodgears.ca](https://woodgears.ca).

Plain HTML/CSS/JS — no build step, no framework. Hosted on GitHub Pages.

## Tools

- **Gear Template Generator** — printable involute spur-gear templates.

More to come (box-joint layout, bandsaw blade length, etc.).

## Local development

Just open `index.html` in a browser. There is no build step.

For a local server (useful if you add fetch-based features later):

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Deployment

This repo is configured for GitHub Pages. Pushes to `main` deploy automatically once Pages is enabled in repo Settings → Pages → Source: `main` branch, `/` root.
