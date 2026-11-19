# Brand images

Sources for the PNGs in `public/brand/`. Edit the HTML, then re-render with headless Chrome
(Git Bash, from the project root):

```bash
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
DOCS="file:///$(pwd -W)/docs/brand"
R="--headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000"

# Profile icon, 400 × 400 (square, full-bleed; platforms crop it to a circle).
# Chrome won't make a window narrower than ~500px, so it's rendered at 800px and half scale.
"$CH" $R --window-size=800,800 --force-device-scale-factor=0.5 --screenshot="public/brand/stow-profile-400.png" "$DOCS/profile-icon.html"

# Banner, 1920 × 600
"$CH" $R --window-size=1920,600 --force-device-scale-factor=1 --screenshot="public/brand/stow-banner-1920x600.png" "$DOCS/banner.html"
```

- For a larger icon, use the same window at a higher scale (e.g. `--window-size=1024,1024 --force-device-scale-factor=1`).
- The banner loads Michroma and Plus Jakarta Sans from Google Fonts, so render it online.
- The banner is laid out on a 1600 × 500 stage drawn at 120%; its text sits in the upper left, clear of a profile picture placed over the bottom-left corner.
- The phone shows practice-account figures, for illustration.
