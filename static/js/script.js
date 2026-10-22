(function skillGapApp() {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const SUGGESTED_SKILLS = [
    "Python", "SQL", "Pandas", "NumPy", "Machine Learning",
    "Git", "Docker", "AWS", "Tableau", "Scikit-Learn",
  ];

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const els = {
    helpBtn: $("helpTooltipBtn"),
    helpBox: $("helpBox"),
    input: $("skillInput"),
    addBtn: $("addSkillBtn"),
    tray: $("skillsTray"),
    empty: $("skillsEmpty"),
    count: $("skillCount"),
    quickAdd: $("quickAddGroup"),
    role: $("roleSelect"),
    error: $("errorBox"),
    analyzeBtn: $("analyzeCta"),
    analyzeLabel: $("analyzeLabel"),
    analyzeIcon: $("analyzeIcon"),
    results: $("results"),
    nav: $("bottomNav"),
    header: document.querySelector(".app-header"),
  };

  const state = { skills: [], fresh: new Set(), gaps: [], busy: false };

  /* =========================================================
     Small helpers
     ========================================================= */
  function h(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, className) {
    const s = h("span", "material-symbols-outlined " + (className || ""), name);
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  const norm = (s) => String(s).trim().toLowerCase();

  // staggered entrance for items rendered after an analysis
  function stagger(node, index) {
    node.classList.add("item-in");
    node.style.setProperty("--i", index);
    return node;
  }

  /* =========================================================
     Motion: count-up numbers, scroll reveal, header shadow
     ========================================================= */
  function animateNumber(el, to, opts) {
    const o = Object.assign({ duration: 900, prefix: "", suffix: "" }, opts);
    const finalText = o.prefix + Math.round(to) + o.suffix;
    if (prefersReduced) {
      el.textContent = finalText;
      return;
    }
    const start = performance.now();
    el._anim = start; // cancels any animation already running on this element
    function frame(now) {
      if (el._anim !== start) return;
      const t = Math.min(1, (now - start) / o.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = o.prefix + Math.round(to * eased) + o.suffix;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }

  let revealObserver = null;
  function armScrollReveal() {
    const sections = Array.from(els.results.children);
    if (revealObserver) revealObserver.disconnect();

    if (prefersReduced || !("IntersectionObserver" in window)) {
      sections.forEach((s) => s.classList.remove("sr", "is-visible"));
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );

    sections.forEach((s) => {
      s.classList.remove("is-visible");
      s.classList.add("sr");
    });
    void els.results.offsetHeight; // flush styles so a re-run replays the animation
    sections.forEach((s) => revealObserver.observe(s));
  }

  function onScroll() {
    els.header.classList.toggle("is-scrolled", window.scrollY > 6);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* =========================================================
     Button effect: click ripple (any element with .ripple)
     ========================================================= */
  document.addEventListener("pointerdown", (e) => {
    const target = e.target.closest(".ripple");
    if (!target || target.disabled || prefersReduced) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const wave = h("span", "ripple-wave");
    wave.style.width = wave.style.height = size + "px";
    wave.style.left = e.clientX - rect.left - size / 2 + "px";
    wave.style.top = e.clientY - rect.top - size / 2 + "px";
    target.appendChild(wave);
    wave.addEventListener("animationend", () => wave.remove());
  });

  /* =========================================================
     Error banner
     ========================================================= */
  function showError(message) {
    els.error.textContent = message;
    els.error.classList.remove("hidden");
  }
  function clearError() {
    els.error.textContent = "";
    els.error.classList.add("hidden");
  }

  /* =========================================================
     Skills: state + rendering
     ========================================================= */
  function hasSkill(name) {
    return state.skills.some((s) => norm(s) === norm(name));
  }

  function addSkills(raw) {
    String(raw)
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!hasSkill(s)) {
          state.skills.push(s);
          state.fresh.add(norm(s));
        }
      });
    renderSkills();
  }

  function removeSkill(name) {
    state.skills = state.skills.filter((s) => norm(s) !== norm(name));
    renderSkills();
  }

  function renderSkills() {
    els.tray.replaceChildren();
    state.skills.forEach((name) => {
      // only newly added chips pop in; existing ones stay still
      const chip = h("span", "chip" + (state.fresh.has(norm(name)) ? " chip-enter" : ""));
      chip.setAttribute("role", "listitem");
      chip.appendChild(h("span", "", name));

      const remove = h("button", "remove-chip-btn");
      remove.type = "button";
      remove.dataset.skill = name;
      remove.setAttribute("aria-label", "Remove " + name);
      remove.appendChild(icon("close", "text-[13px]"));
      chip.appendChild(remove);

      els.tray.appendChild(chip);
    });
    state.fresh.clear();

    els.count.textContent = state.skills.length;
    els.empty.classList.toggle("hidden", state.skills.length > 0);

    els.quickAdd.replaceChildren();
    SUGGESTED_SKILLS.filter((s) => !hasSkill(s)).forEach((s) => {
      const b = h("button", "quick-add-btn ripple ripple-dark", "+ " + s);
      b.type = "button";
      b.dataset.skill = s;
      els.quickAdd.appendChild(b);
    });
  }

  els.tray.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-chip-btn");
    if (btn) removeSkill(btn.dataset.skill);
  });

  els.quickAdd.addEventListener("click", (e) => {
    const btn = e.target.closest(".quick-add-btn");
    if (btn) addSkills(btn.dataset.skill);
  });

  els.addBtn.addEventListener("click", () => {
    addSkills(els.input.value);
    els.input.value = "";
    els.input.focus();
  });

  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.addBtn.click();
    }
  });

  els.helpBtn.addEventListener("click", () => {
    const hidden = els.helpBox.classList.toggle("hidden");
    els.helpBtn.setAttribute("aria-expanded", String(!hidden));
  });

  /* =========================================================
     API
     ========================================================= */
  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* non-JSON response (e.g. an HTML error page) */
    }

    if (!res.ok) {
      throw new Error((data && data.error) || "Request failed (" + res.status + ")");
    }
    return data;
  }

  /* =========================================================
     Response normalizers
     If your SkillGapAnalyzer uses different key names, add them to the lists below.
     ========================================================= */
  function pick(obj, keys, fallback) {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return fallback;
  }

  function toList(value) {
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function normalizeAnalysis(r) {
    const matched = toList(pick(r, ["matched_skills", "matching_skills", "matched", "skills_matched", "common_skills", "have"], []));
    const missing = toList(pick(r, ["missing_skills", "skill_gap", "skill_gaps", "missing", "gap", "skills_to_learn", "to_learn"], []));
    const required = toList(pick(r, ["required_skills", "required", "job_skills", "role_skills"], []));

    let pct = pick(r, ["match_percentage", "match_percent", "match_score", "percentage", "score", "similarity"], null);
    pct = pct === null ? null : Number(pct);

    if (pct === null || Number.isNaN(pct)) {
      const total = matched.length + missing.length;
      pct = total ? (matched.length / total) * 100 : 0;
    } else if (pct <= 1) {
      pct = pct * 100; // 0-1 fraction -> percent
    }
    pct = Math.max(0, Math.min(100, pct));

    const requiredCount = required.length || matched.length + missing.length;
    return { matched, missing, requiredCount, pct };
  }

  function normalizeRecommendations(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        const role = pick(item, ["job_role", "role", "title", "name"], "");
        let pct = Number(pick(item, ["similarity", "match_percentage", "score"], 0));
        if (Number.isNaN(pct)) pct = 0;
        return { role: String(role), pct: Math.max(0, Math.min(100, pct)) };
      })
      .filter((r) => r.role);
  }

  /* =========================================================
     Results rendering
     ========================================================= */
  function verdict(pct) {
    if (pct >= 75) return { badge: "Strong match", message: "Your skills cover most of what this role asks for." };
    if (pct >= 50) return { badge: "Competitive match", message: "You have a solid base. Closing the gaps below will make you a strong candidate." };
    return { badge: "Early stage", message: "There is a fair amount to learn for this role. Start with the gaps below." };
  }

  function renderRing(pct) {
    const ring = $("matchRing");
    const circumference = 2 * Math.PI * Number(ring.getAttribute("r"));
    ring.setAttribute("stroke-dasharray", circumference.toFixed(2));
    ring.setAttribute("stroke-dashoffset", circumference.toFixed(2));
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        ring.setAttribute("stroke-dashoffset", (circumference * (1 - pct / 100)).toFixed(2))
      )
    );
    animateNumber($("ringPercent"), pct, { duration: 1000, suffix: "%" });
    $("ringWrap").setAttribute("aria-label", Math.round(pct) + " percent role match");
  }

  function renderAnalysis(a, role) {
    const v = verdict(a.pct);

    $("resRole").textContent = role;
    $("resBadge").textContent = v.badge;
    animateNumber($("resHeadline"), a.pct, { duration: 1000, suffix: "% role match" });
    $("resMessage").textContent = v.message;
    renderRing(a.pct);

    animateNumber($("statMatched"), a.matched.length, { duration: 800 });
    animateNumber($("statGap"), a.missing.length, { duration: 800 });
    animateNumber($("statRequired"), a.requiredCount, { duration: 800 });

    // progress bar grows from 0 on every run
    const barPct = a.requiredCount ? Math.min(100, (a.matched.length / a.requiredCount) * 100) : 0;
    const bar = $("matchBar");
    bar.style.width = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = barPct + "%")));
    $("matchedLabel").textContent = a.matched.length + " of " + a.requiredCount;

    const matchedList = $("matchedList");
    matchedList.replaceChildren();
    if (!a.matched.length) {
      matchedList.appendChild(h("p", "font-body-sm text-body-sm text-on-surface-variant", "None of your skills match this role yet."));
    }
    a.matched.forEach((s, i) => {
      const badge = stagger(h("div", "match-badge"), i);
      badge.appendChild(icon("check", "text-tertiary text-[15px]"));
      badge.appendChild(h("span", "", s));
      matchedList.appendChild(badge);
    });

    state.gaps = a.missing;
    $("gapLabel").textContent = a.missing.length + (a.missing.length === 1 ? " gap" : " gaps");
    const gapList = $("gapList");
    gapList.replaceChildren();
    if (!a.missing.length) {
      gapList.appendChild(h("p", "font-body-sm text-body-sm text-tertiary", "No gaps. You cover every required skill for this role."));
    }
    a.missing.forEach((s, i) => {
      const item = stagger(h("div", "gap-item"), i);
      item.appendChild(h("span", "w-2 h-2 rounded-full bg-error shrink-0"));
      item.appendChild(h("span", "", s));
      gapList.appendChild(item);
    });

    // reset the checklist whenever new results arrive
    $("sprintOutput").classList.add("hidden");
    $("sprintOutput").replaceChildren();
  }

  function renderRecommendations(recs, currentRole) {
    const list = $("altList");
    list.replaceChildren();

    const others = recs.filter((r) => norm(r.role) !== norm(currentRole)).slice(0, 5);
    if (!others.length) {
      list.appendChild(h("p", "font-body-sm text-body-sm text-on-surface-variant", "No other roles to suggest yet."));
      return;
    }

    others.forEach((r, i) => {
      const card = stagger(h("button", "role-card ripple ripple-dark"), i);
      card.type = "button";
      card.dataset.role = r.role;
      card.setAttribute("aria-label", "Analyze " + r.role);

      card.appendChild(h("span", "font-headline-sm text-headline-sm text-on-surface font-semibold", r.role));

      const right = h("span", "flex items-center gap-2");
      right.appendChild(h("span", "font-headline-sm text-headline-sm text-primary font-bold", r.pct.toFixed(0) + "%"));
      right.appendChild(icon("chevron_right", "text-[18px]"));
      card.appendChild(right);

      list.appendChild(card);
    });
  }

  // Tapping an alternative role switches the target and re-runs the analysis
  $("altList").addEventListener("click", (e) => {
    const card = e.target.closest(".role-card");
    if (!card) return;
    const option = Array.from(els.role.options).find((o) => norm(o.value) === norm(card.dataset.role));
    if (option) {
      els.role.value = option.value;
      runAnalysis();
      window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
    }
  });

  /* =========================================================
     Learning checklist
     ========================================================= */
  $("generateSprintBtn").addEventListener("click", () => {
    const out = $("sprintOutput");
    out.replaceChildren();

    if (!state.gaps.length) {
      out.appendChild(stagger(h("li", "font-body-sm text-body-sm text-tertiary", "Nothing to learn. You already cover every required skill."), 0));
    } else {
      state.gaps.forEach((skill, i) => {
        const li = stagger(h("li", "gap-item"), i);
        li.appendChild(h("span", "text-secondary font-bold", String(i + 1) + "."));
        li.appendChild(h("span", "", "Learn " + skill));
        out.appendChild(li);
      });
    }
    out.classList.remove("hidden");
  });

  /* =========================================================
     Analyze button: idle -> busy (spinner) -> done (check) -> idle
     ========================================================= */
  const BUTTON_STATES = {
    idle: { label: "Analyze skill gap", icon: "arrow_forward" },
    busy: { label: "Analyzing...", icon: "progress_activity" },
    done: { label: "Updated", icon: "check" },
  };
  let doneTimer = null;

  function setButtonState(mode) {
    clearTimeout(doneTimer);
    const s = BUTTON_STATES[mode];
    state.busy = mode === "busy";
    els.analyzeBtn.disabled = state.busy;
    els.analyzeLabel.textContent = s.label;
    els.analyzeIcon.textContent = s.icon;
    els.analyzeIcon.classList.toggle("spin", state.busy);
    if (mode === "done") doneTimer = setTimeout(() => setButtonState("idle"), 1300);
  }

  /* =========================================================
     Main action
     ========================================================= */
  async function runAnalysis() {
    if (state.busy) return;
    clearError();

    // pick up anything typed but not yet added
    if (els.input.value.trim()) {
      addSkills(els.input.value);
      els.input.value = "";
    }

    const role = els.role.value;
    if (!state.skills.length) return showError("Please add at least one skill.");
    if (!role) return showError("Please select a target job role.");

    const payload = { skills: state.skills.join(", "), target_role: role };

    setButtonState("busy");
    try {
      const [analysisRes, recRes] = await Promise.allSettled([
        postJSON("/analyze", payload),
        postJSON("/recommend", { skills: payload.skills }),
      ]);

      if (analysisRes.status === "rejected") throw analysisRes.reason;

      renderAnalysis(normalizeAnalysis(analysisRes.value), role);
      renderRecommendations(
        recRes.status === "fulfilled" ? normalizeRecommendations(recRes.value) : [],
        role
      );

      els.results.classList.remove("hidden");
      armScrollReveal();
      els.results.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });

      if (recRes.status === "rejected") console.warn("Recommendations failed:", recRes.reason);
      setButtonState("done");
    } catch (err) {
      showError(err.message || "Something went wrong. Please try again.");
      setButtonState("idle");
    }
  }

  els.analyzeBtn.addEventListener("click", runAnalysis);

  /* =========================================================
     Bottom nav
     ========================================================= */
  const navLinks = els.nav.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navLinks.forEach((l) => {
        const active = l === link;
        l.classList.toggle("is-active", active);
        if (active) l.setAttribute("aria-current", "page");
        else l.removeAttribute("aria-current");
      });
    });
  });

  renderSkills();
})();