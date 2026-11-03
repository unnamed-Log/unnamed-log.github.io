// Enhancements for Markdown extensions and the documented MDX-style components.
document.addEventListener("DOMContentLoaded", () => {
  const article = document.querySelector(".article-body");
  const themeButton = document.querySelector(".theme-toggle");
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const applyTheme = (theme, persist = false) => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f2efdf" : "#16251f");
    if (persist) {
      try { localStorage.setItem("simple-blog-theme", theme); } catch (error) { /* Storage may be disabled. */ }
    }
    if (themeButton) {
      const next = theme === "dark" ? "light" : "dark";
      const nextLabel = `${next[0].toUpperCase()}${next.slice(1)}`;
      themeButton.textContent = `Switch to ${nextLabel} Theme`;
      themeButton.setAttribute("aria-label", `Switch to ${nextLabel} Theme`);
    }
    if (window.beyondErrorsRenderMermaid) window.beyondErrorsRenderMermaid();
  };
  applyTheme(document.documentElement.dataset.theme || "dark");
  themeButton?.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });

  const returnKey = "simple-blog-list-return";
  const backLink = document.querySelector("a.back");
  try {
    const storedReturn = JSON.parse(sessionStorage.getItem(returnKey) || "null");
    const storedUrl = storedReturn && new URL(storedReturn.url, window.location.origin);
    if (storedUrl?.origin === window.location.origin && storedUrl.pathname === window.location.pathname && storedUrl.search === window.location.search) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, storedReturn.scrollY);
        requestAnimationFrame(() => document.documentElement.style.removeProperty("scroll-behavior"));
      }));
      sessionStorage.removeItem(returnKey);
    } else if (backLink && storedUrl?.origin === window.location.origin) {
      backLink.href = storedUrl.href;
      if (storedReturn.label) backLink.textContent = `← Back to ${storedReturn.label}`;
    }
  } catch (error) { /* Session storage may be disabled. */ }

  document.addEventListener("click", (event) => {
    const postLink = event.target.closest("a.post-title");
    if (!postLink || !document.querySelector(".posts") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      const homeTitle = document.querySelector(".site-title")?.firstChild?.textContent.trim();
      const pageTitle = document.querySelector(".page-heading")?.textContent.trim();
      sessionStorage.setItem(returnKey, JSON.stringify({ url: window.location.href, scrollY: window.scrollY, label: homeTitle || pageTitle || "simple-blog" }));
    } catch (error) { /* Session storage may be disabled. */ }
  });

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === "_blank" || anchor.hasAttribute("download") || motionPreference.matches) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || (destination.pathname === window.location.pathname && destination.search === window.location.search)) return;
    const main = document.querySelector(".container");
    if (!main) return;
    event.preventDefault();
    main.classList.add("page-leaving");
    window.setTimeout(() => window.location.assign(destination.href), 150);
  });

  // Turn GitHub alert blockquotes into labeled, color-coded callouts.
  article?.querySelectorAll("blockquote").forEach((quote) => {
    const first = quote.querySelector("p");
    const match = first?.textContent.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
    if (!match) return;
    const kind = match[1].toLowerCase();
    first.textContent = first.textContent.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, "");
    quote.classList.add("alert", `alert-${kind}`);
    const heading = document.createElement("p");
    heading.className = "alert-heading";
    heading.textContent = match[1][0] + match[1].slice(1).toLowerCase();
    quote.prepend(heading);
  });

  // The generic Hugo Markdown renderer keeps custom HTML elements. Hydrate the
  // small, documented component set into accessible native elements.
  article?.querySelectorAll("card").forEach((node) => {
    const card = document.createElement("section");
    card.className = "component-card";
    const heading = document.createElement("h4");
    heading.textContent = `${node.getAttribute("icon") || ""} ${node.getAttribute("title") || ""}`.trim();
    if (heading.textContent) card.append(heading);
    while (node.firstChild) card.append(node.firstChild);
    node.replaceWith(card);
  });

  article?.querySelectorAll("grid").forEach((node) => {
    const grid = document.createElement("div");
    grid.className = "mdx-grid";
    const columns = Number.parseInt(node.getAttribute("columns") || "3", 10);
    grid.style.setProperty("--grid-columns", String(Number.isFinite(columns) ? Math.min(4, Math.max(1, columns)) : 3));
    while (node.firstChild) grid.append(node.firstChild);
    node.replaceWith(grid);
  });

  article?.querySelectorAll("tabs").forEach((node) => {
    const wrapper = document.createElement("section");
    wrapper.className = "mdx-tabs";
    const nav = document.createElement("div");
    nav.className = "mdx-tab-list";
    nav.setAttribute("role", "tablist");
    const panels = [];
    [...node.querySelectorAll(":scope > tab")].forEach((tab, index) => {
      const title = tab.getAttribute("title") || `Tab ${index + 1}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mdx-tab-button";
      button.textContent = title;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(index === 0));
      const panel = document.createElement("div");
      panel.className = "mdx-tab-panel";
      panel.setAttribute("role", "tabpanel");
      panel.hidden = index !== 0;
      while (tab.firstChild) panel.append(tab.firstChild);
      button.addEventListener("click", () => {
        panels.forEach((entry, i) => {
          entry.panel.hidden = i !== index;
          entry.button.setAttribute("aria-selected", String(i === index));
        });
      });
      nav.append(button);
      panels.push({ button, panel });
      tab.remove();
    });
    wrapper.append(nav, ...panels.map((entry) => entry.panel));
    node.replaceWith(wrapper);
  });

  article?.querySelectorAll("button[variant]").forEach((button) => {
    button.classList.add("demo-button");
    if (button.getAttribute("variant") === "primary") button.classList.add("primary");
  });
  article?.querySelectorAll("badge").forEach((node) => {
    const badge = document.createElement("span");
    badge.className = `badge badge-${node.getAttribute("color") || "green"}`;
    badge.textContent = node.textContent;
    node.replaceWith(badge);
  });
  article?.querySelectorAll("alert").forEach((node) => {
    const alert = document.createElement("div");
    const kind = node.getAttribute("type") || "note";
    alert.className = `alert alert-${kind}`;
    alert.innerHTML = `<p class="alert-heading">${kind[0].toUpperCase()}${kind.slice(1)}</p>${node.innerHTML}`;
    node.replaceWith(alert);
  });
  article?.querySelectorAll("progress").forEach((node) => {
    const value = Number.parseInt(node.getAttribute("value") || "75", 10);
    const max = Number.parseInt(node.getAttribute("max") || "100", 10);
    const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 75;
    const progress = document.createElement("progress");
    progress.className = "demo-progress";
    progress.max = Number.isFinite(max) && max > 0 ? max : 100;
    progress.value = safeValue;
    progress.setAttribute("aria-label", `Progress: ${safeValue}%`);
    const following = [...node.childNodes];
    node.replaceWith(progress, ...following);
  });

  // Hugo escapes JSX-like props that cannot be represented in HTML. Render the
  // chart and select samples as small, deterministic HTML controls.
  article?.querySelectorAll("p").forEach((paragraph) => {
    const text = paragraph.textContent.trim();
    if (text.startsWith("<BarChart")) {
      const chart = document.createElement("div");
      chart.className = "demo-chart";
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", "Monthly values: January 30, February 50, March 80");
      [["January", 30], ["February", 50], ["March", 80]].forEach(([label, value]) => {
        const column = document.createElement("div");
        column.className = "demo-chart-column";
        column.innerHTML = `<span class="demo-chart-bar" style="height:${value}%"></span><span class="demo-chart-label">${label}</span>`;
        chart.append(column);
      });
      paragraph.replaceWith(chart);
    } else if (text.startsWith("<Select options=")) {
      const select = document.createElement("select");
      select.className = "demo-input";
      select.setAttribute("aria-label", "Choose an option");
      [["Option A", "a"], ["Option B", "b"]].forEach(([label, value]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option);
      });
      paragraph.replaceWith(select);
    }
  });
  article?.querySelectorAll("input[placeholder]").forEach((input) => input.classList.add("demo-input"));
  article?.querySelectorAll("checkbox").forEach((node) => {
    const label = document.createElement("label"); label.className = "demo-checkbox";
    const input = document.createElement("input"); input.type = "checkbox";
    label.append(input, document.createTextNode(` ${node.getAttribute("label") || ""}`));
    const following = [...node.childNodes];
    node.replaceWith(label, ...following);
  });
  article?.querySelectorAll("slider").forEach((node) => {
    const input = document.createElement("input"); input.type = "range"; input.className = "demo-input";
    input.min = node.getAttribute("min") || "0"; input.max = node.getAttribute("max") || "100"; input.value = node.getAttribute("defaultvalue") || "50";
    const following = [...node.childNodes];
    node.replaceWith(input, ...following);
  });

  // Turn Mermaid fences into diagrams and use a high-contrast base palette.
  article?.querySelectorAll("pre code.language-mermaid").forEach((code) => {
    const box = document.createElement("div");
    box.className = "mermaid";
    box.textContent = code.textContent;
    box.dataset.mermaidSource = code.textContent;
    code.closest("pre").replaceWith(box);
  });
  if (article?.querySelector(".mermaid")) {
    const mermaidSources = [
      "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
      "https://unpkg.com/mermaid@11/dist/mermaid.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js"
    ];
    const loadMermaid = (index = 0) => new Promise((resolve, reject) => {
      if (window.mermaid) return resolve(window.mermaid);
      if (index >= mermaidSources.length) return reject(new Error("Unable to load Mermaid from the available CDNs."));
      const script = document.createElement("script");
      script.src = mermaidSources[index];
      script.onload = () => window.mermaid ? resolve(window.mermaid) : loadMermaid(index + 1).then(resolve, reject);
      script.onerror = () => { script.remove(); loadMermaid(index + 1).then(resolve, reject); };
      document.head.append(script);
    });
    let renderQueue = Promise.resolve();
    loadMermaid().then((mermaid) => {
      const renderMermaid = () => {
        renderQueue = renderQueue.catch(() => {}).then(async () => {
          const light = document.documentElement.dataset.theme === "light";
          const palette = light ? {
          background: "#ece9d8", primaryColor: "#cad8b8", primaryTextColor: "#29392d",
          primaryBorderColor: "#637954", secondaryColor: "#d8dfc7", secondaryTextColor: "#29392d",
          tertiaryColor: "#e1ddc8", tertiaryTextColor: "#29392d", lineColor: "#657a56",
          textColor: "#29392d", mainBkg: "#cad8b8", nodeBorder: "#637954", fontSize: "16px",
          useGradient: false, git0: "#aebf96", gitBranchLabel0: "#29392d", cScaleLabel0: "#29392d",
          cScale1: "#d1ddbd", cScaleLabel1: "#29392d", cScale2: "#c6d8c5", cScaleLabel2: "#29392d",
          cScale3: "#ebdcae", cScaleLabel3: "#29392d", cScale4: "#c2d9d8", cScaleLabel4: "#29392d",
          cScale5: "#d7c7df", cScaleLabel5: "#29392d", cScale6: "#ecd0b5", cScaleLabel6: "#29392d",
          cScale7: "#c4d0e4", cScaleLabel7: "#29392d", cScale8: "#e1d0b9", cScaleLabel8: "#29392d",
          cScale9: "#bcd7ce", cScaleLabel9: "#29392d", cScale10: "#e3c8cd", cScaleLabel10: "#29392d",
          cScale11: "#d4deb8", cScaleLabel11: "#29392d"
        } : {
          background: "#1c2a22", primaryColor: "#557455", primaryTextColor: "#f7f3e5",
          primaryBorderColor: "#c4d09d", secondaryColor: "#657f65", secondaryTextColor: "#f7f3e5",
          tertiaryColor: "#789071", tertiaryTextColor: "#f7f3e5", lineColor: "#c4d09d",
          textColor: "#f7f3e5", mainBkg: "#557455", nodeBorder: "#c4d09d", fontSize: "16px",
          useGradient: false, git0: "#668255", gitBranchLabel0: "#fffdf2", cScaleLabel0: "#fffdf2",
          cScale1: "#5b7650", cScaleLabel1: "#fffdf2", cScale2: "#496a57", cScaleLabel2: "#fffdf2",
          cScale3: "#7a704e", cScaleLabel3: "#fffdf2", cScale4: "#4c6d72", cScaleLabel4: "#fffdf2",
          cScale5: "#705878", cScaleLabel5: "#fffdf2", cScale6: "#80614b", cScaleLabel6: "#fffdf2",
          cScale7: "#50698b", cScaleLabel7: "#fffdf2", cScale8: "#7a654b", cScaleLabel8: "#fffdf2",
          cScale9: "#4f746d", cScaleLabel9: "#fffdf2", cScale10: "#80565e", cScaleLabel10: "#fffdf2",
          cScale11: "#6d784f", cScaleLabel11: "#fffdf2"
          };
          const estimateGanttWidth = (source) => {
            const dates = [...source.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)]
              .map((match) => Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
            const durationDays = [...source.matchAll(/\b(\d+)(d|w|m)\b/gi)].reduce((sum, match) => {
              const amount = Number(match[1]);
              return sum + amount * ({ d: 1, w: 7, m: 30 }[match[2].toLowerCase()]);
            }, 0);
            if (dates.length < 2 && !durationDays) return 1800;
            const spanDays = Math.max(
              dates.length > 1 ? Math.ceil((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1 : 0,
              durationDays
            );
            return Math.min(12000, Math.max(1200, spanDays * 82 + 360));
          };
          const diagrams = [...article.querySelectorAll(".mermaid")];
          for (const diagram of diagrams) {
            diagram.removeAttribute("data-processed");
            const source = diagram.dataset.mermaidSource || diagram.textContent;
            const isGantt = /^\s*gantt\b/i.test(source);
            diagram.classList.toggle("mermaid-gantt", isGantt);
            diagram.textContent = source;
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: "strict",
              theme: "base",
              themeVariables: palette,
              gantt: {
                tickInterval: "1day",
                axisFormat: "%Y-%m-%d",
                useWidth: isGantt ? estimateGanttWidth(source) : 1800
              }
            });
            await mermaid.run({ nodes: [diagram] });
          }
        });
        return renderQueue;
      };
      window.beyondErrorsRenderMermaid = () => renderMermaid().catch((error) => console.error("Mermaid rendering failed.", error));
      window.beyondErrorsRenderMermaid();
    }).catch((error) => console.error("Mermaid failed to load.", error));
  }

  // Render inline and display math with KaTeX, leaving code samples untouched.
  const mathNodes = [...document.querySelectorAll(".article-body")];
  if (mathNodes.some((node) => /\\\[|\\\(|\$\$|\$[^$\n]+\$/.test(node.textContent))) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    script.onload = () => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"; document.head.append(css);
      mathNodes.forEach((root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (node) => node.parentElement.closest("code,pre") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        const nodes = []; while (walker.nextNode()) if (/\$\$?[\s\S]+?\$\$?/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
          const fragment = document.createDocumentFragment();
          node.nodeValue.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g).forEach((part) => {
            if (/^\$\$[\s\S]+\$\$$/.test(part)) { const el = document.createElement("span"); katex.render(part.slice(2, -2), el, { displayMode: true, throwOnError: false }); fragment.append(el); }
            else if (/^\$[^$]+\$$/.test(part)) { const el = document.createElement("span"); katex.render(part.slice(1, -1), el, { throwOnError: false }); fragment.append(el); }
            else fragment.append(document.createTextNode(part));
          });
          node.parentNode.replaceChild(fragment, node);
        });
      });
    };
    document.head.append(script);
  }
});
