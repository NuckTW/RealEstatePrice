Light / dark theme switch (明亮 / 暗色). Flips the whole token system by setting `data-theme` on `<html>`; persists to localStorage.

```jsx
// uncontrolled — manages <html> + storage itself:
<ThemeToggle />

// controlled from app state:
<ThemeToggle value={theme} onChange={setTheme} labels={false} />

// on boot, restore the saved choice:
applyTheme(getStoredTheme());
```

Default theme is dark. Use `labels={false}` for an icon-only switch in tight chrome. Pair `getStoredTheme()` + `applyTheme()` at app start so reloads keep the user's choice.
