(function skillGapApp() {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const SUGGESTED_SKILLS = [
    "Python", "SQL", "Pandas", "NumPy", "Machine Learning",
    "Git", "Docker", "AWS", "Tableau", "Scikit-Learn",
  ];

  const RESUME_EXTENSIONS = ["pdf", "docx", "txt"];
  const RESUME_MAX_BYTES = 5 * 1024 * 1024;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const els = {
    helpBtn: $("helpTooltipBtn"),
    helpBox: $("helpBox"),
    input: $("skillInput"),
    suggest: $("skillSuggestions"),
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

    // Resume upload (NEW)
    resumeDrop: $("resumeDrop"),
    resumeInput: $("resumeInput"),
    resumeBtn: $("resumeBtn"),
    resumeBtnLabel: $("resumeBtnLabel"),
    resumeStatus: $("resumeStatus"),

    // Roles page: search + detail (NEW)
    rolesBrowse: $("rolesBrowse"),
    rolesList: $("rolesList"),
    roleSearch: $("roleSearch"),
    roleSearchClear: $("roleSearchClear"),
    roleCount: $("roleCount"),
    rolesEmpty: $("rolesEmpty"),
    roleDetail: $("roleDetail"),
    roleBack: $("roleBack"),
    roleDetailTitle: $("roleDetailTitle"),
    roleDetailSummary: $("roleDetailSummary"),
    roleHaveCard: $("roleHaveCard"),
    roleHaveCount: $("roleHaveCount"),
    roleHaveList: $("roleHaveList"),
    roleNeedHeading: $("roleNeedHeading"),
    roleNeedCount: $("roleNeedCount"),
    roleNeedList: $("roleNeedList"),
    roleDetailError: $("roleDetailError"),
    roleUseBtn: $("roleUseBtn"),
  };

  const state = {
    skills: [],
    fresh: new Set(),
    gaps: [],
    busy: false,
    uploading: false,
    detailRole: "",
  };

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
    hideSuggestions();
    addSkills(els.input.value);
    els.input.value = "";
    els.input.focus();
  });

  els.helpBtn.addEventListener("click", () => {
    const hidden = els.helpBox.classList.toggle("hidden");
    els.helpBtn.setAttribute("aria-expanded", String(!hidden));
  });

  /* =========================================================
     Skill autocomplete
     Calls GET /api/skills/suggest?q=...  after 2+ characters.
     Works on the last comma-separated piece, so "Python, sq"
     suggests skills for "sq".
     ========================================================= */
  const SUGGEST_MIN_CHARS = 2;
  const SUGGEST_DELAY_MS = 200;

  const suggestState = { items: [], active: -1, timer: null, seq: 0 };

  // Text after the last comma/semicolon/newline = the skill being typed
  function currentToken() {
    const parts = els.input.value.split(/[,;\n]/);
    return parts[parts.length - 1].trim();
  }

  // Everything typed before the skill being typed (already complete skills)
  function previousPart() {
    const v = els.input.value;
    const i = Math.max(v.lastIndexOf(","), v.lastIndexOf(";"), v.lastIndexOf("\n"));
    return i === -1 ? "" : v.slice(0, i + 1);
  }

  function suggestionsOpen() {
    return !els.suggest.classList.contains("hidden");
  }

  function hideSuggestions() {
    clearTimeout(suggestState.timer);
    suggestState.seq++; // ignore any response still in flight
    suggestState.items = [];
    suggestState.active = -1;
    els.suggest.classList.add("hidden");
    els.suggest.replaceChildren();
    els.input.setAttribute("aria-expanded", "false");
    els.input.removeAttribute("aria-activedescendant");
  }

  function setActiveSuggestion(index) {
    const rows = els.suggest.children;
    Array.from(rows).forEach((li) => {
      li.classList.remove("is-active");
      li.setAttribute("aria-selected", "false");
    });
    suggestState.active = index;
    if (index >= 0 && rows[index]) {
      rows[index].classList.add("is-active");
      rows[index].setAttribute("aria-selected", "true");
      rows[index].scrollIntoView({ block: "nearest" });
      els.input.setAttribute("aria-activedescendant", rows[index].id);
    } else {
      els.input.removeAttribute("aria-activedescendant");
    }
  }

  // Build <li> with the matching part in <strong> (no innerHTML = no XSS)
  function buildSuggestionRow(skill, query, index) {
    const li = h("li");
    li.id = "skillSuggestion-" + index;
    li.dataset.index = String(index);
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");

    const at = skill.toLowerCase().indexOf(query.toLowerCase());
    if (at === -1) {
      li.textContent = skill;
    } else {
      const span = h("span");
      span.appendChild(document.createTextNode(skill.slice(0, at)));
      span.appendChild(h("strong", "", skill.slice(at, at + query.length)));
      span.appendChild(document.createTextNode(skill.slice(at + query.length)));
      li.appendChild(span);
    }
    return li;
  }

  function renderSuggestions(list, query) {
    suggestState.items = list;
    suggestState.active = -1;
    els.suggest.replaceChildren();

    if (!list.length) {
      els.suggest.classList.add("hidden");
      els.input.setAttribute("aria-expanded", "false");
      return;
    }

    list.forEach((skill, i) => els.suggest.appendChild(buildSuggestionRow(skill, query, i)));
    els.suggest.classList.remove("hidden");
    els.input.setAttribute("aria-expanded", "true");
  }

  async function fetchSuggestions(query) {
    const mySeq = ++suggestState.seq;
    try {
      const res = await fetch("/api/skills/suggest?limit=8&q=" + encodeURIComponent(query));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const list = await res.json();

      // a newer keystroke (or a close) happened while waiting: drop this result
      if (mySeq !== suggestState.seq) return;

      // don't suggest skills that were already added
      const fresh = Array.isArray(list) ? list.filter((s) => !hasSkill(s)) : [];
      renderSuggestions(fresh, query);
    } catch (err) {
      console.warn("Skill suggestions failed:", err);
      if (mySeq === suggestState.seq) hideSuggestions();
    }
  }

  function chooseSuggestion(skill) {
    // keep skills typed before it, e.g. "Python, sq" + "SQL" -> adds Python and SQL
    const before = previousPart();
    hideSuggestions();
    addSkills(before + " " + skill);
    els.input.value = "";
    els.input.focus();
  }

  els.input.addEventListener("input", () => {
    const query = currentToken();
    clearTimeout(suggestState.timer);
    if (query.length < SUGGEST_MIN_CHARS) {
      hideSuggestions();
      return;
    }
    suggestState.timer = setTimeout(() => fetchSuggestions(query), SUGGEST_DELAY_MS);
  });

  // One keydown handler: arrows/Esc drive the dropdown; Enter picks the
  // highlighted suggestion, otherwise adds the typed text like before.
  els.input.addEventListener("keydown", (e) => {
    const open = suggestionsOpen() && suggestState.items.length > 0;

    if (open && e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((suggestState.active + 1) % suggestState.items.length);
    } else if (open && e.key === "ArrowUp") {
      e.preventDefault();
      const n = suggestState.items.length;
      setActiveSuggestion((suggestState.active - 1 + n) % n);
    } else if (open && e.key === "Escape") {
      e.preventDefault();
      hideSuggestions();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && suggestState.active >= 0) {
        chooseSuggestion(suggestState.items[suggestState.active]);
      } else {
        els.addBtn.click();
      }
    }
  });

  // mousedown (not click) so the input keeps focus and blur doesn't close the list first
  els.suggest.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-index]");
    if (!li) return;
    e.preventDefault();
    const skill = suggestState.items[Number(li.dataset.index)];
    if (skill) chooseSuggestion(skill);
  });

  els.input.addEventListener("blur", () => hideSuggestions());

  /* =========================================================
     API
     ========================================================= */
  async function readJSON(res) {
    try {
      return await res.json();
    } catch (_) {
      return null; // non-JSON response (e.g. an HTML error page)
    }
  }

  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await readJSON(res);

    if (!res.ok) {
      throw new Error((data && data.error) || "Request failed (" + res.status + ")");
    }
    return data;
  }

  /* =========================================================
     Resume upload (NEW)
     POST /api/resume/extract (multipart, field "resume")
     -> adds the detected skills as chips, then analyzes
        automatically if a target role is already selected.
     ========================================================= */
  function setResumeStatus(kind, message) {
    const colors = {
      info: "text-on-surface-variant",
      success: "text-tertiary",
      error: "text-error",
    };
    els.resumeStatus.className = "font-body-sm text-body-sm " + (colors[kind] || colors.info);
    els.resumeStatus.textContent = message;
  }

  function clearResumeStatus() {
    els.resumeStatus.textContent = "";
    els.resumeStatus.className = "hidden font-body-sm text-body-sm";
  }

  function setUploading(on) {
    state.uploading = on;
    els.resumeBtn.disabled = on;
    els.resumeBtnLabel.textContent = on ? "Reading resume..." : "Upload resume";
    const ico = els.resumeBtn.querySelector(".material-symbols-outlined");
    if (ico) {
      ico.textContent = on ? "progress_activity" : "upload_file";
      ico.classList.toggle("spin", on);
    }
  }

  async function handleResumeFile(file) {
    if (!file || state.uploading) return;
    clearError();

    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    if (!RESUME_EXTENSIONS.includes(ext)) {
      return setResumeStatus("error", "Unsupported file type. Please upload a PDF, DOCX or TXT file.");
    }
    if (file.size === 0) {
      return setResumeStatus("error", "That file is empty.");
    }
    if (file.size > RESUME_MAX_BYTES) {
      return setResumeStatus("error", "That file is too large. The maximum size is 5 MB.");
    }

    setUploading(true);
    setResumeStatus("info", "Reading " + file.name + "...");

    try {
      const body = new FormData();
      body.append("resume", file);

      // Do not set Content-Type here: the browser adds the multipart boundary.
      const res = await fetch("/api/resume/extract", { method: "POST", body: body });
      const data = await readJSON(res);

      if (!res.ok) {
        throw new Error((data && data.error) || "Upload failed (" + res.status + ")");
      }

      const found = Array.isArray(data.skills) ? data.skills : [];
      if (!found.length) {
        setResumeStatus(
          "info",
          "No known skills were found in " + file.name + ". You can add skills manually below."
        );
        return;
      }

      const before = state.skills.length;
      addSkills(found.join(", "));
      const added = state.skills.length - before;

      const summary =
        "Found " + found.length + (found.length === 1 ? " skill" : " skills") +
        " in " + file.name + (added < found.length ? " (" + added + " new)" : "") + ".";

      if (els.role.value) {
        setResumeStatus("success", summary + " Analyzing...");
        runAnalysis();
      } else {
        setResumeStatus("success", summary + " Now select a target role and press Analyze.");
      }
    } catch (err) {
      setResumeStatus("error", err.message || "Could not read this resume.");
    } finally {
      setUploading(false);
      els.resumeInput.value = ""; // lets the same file be chosen again
    }
  }

  els.resumeBtn.addEventListener("click", () => els.resumeInput.click());

  els.resumeInput.addEventListener("change", () => {
    handleResumeFile(els.resumeInput.files && els.resumeInput.files[0]);
  });

  // Drag and drop a file onto the resume area
  ["dragenter", "dragover"].forEach((type) =>
    els.resumeDrop.addEventListener(type, (e) => {
      e.preventDefault();
      els.resumeDrop.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((type) =>
    els.resumeDrop.addEventListener(type, (e) => {
      e.preventDefault();
      els.resumeDrop.classList.remove("is-dragover");
    })
  );
  els.resumeDrop.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleResumeFile(file);
  });

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
    hideSuggestions();

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
     Roles page: live search (NEW)
     Filters the role cards already on the page. Every word typed
     must appear in the role name, so "python dev" finds
     "Python Developer".
     ========================================================= */
  const roleCards = Array.from(els.rolesList.querySelectorAll(".role-card"));

  function filterRoles() {
    const words = norm(els.roleSearch.value).split(/\s+/).filter(Boolean);
    let visible = 0;

    roleCards.forEach((card) => {
      const name = norm(card.dataset.role);
      const match = words.every((w) => name.includes(w));
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });

    els.roleSearchClear.classList.toggle("hidden", !els.roleSearch.value);
    els.rolesEmpty.classList.toggle("hidden", visible > 0);

    const total = roleCards.length;
    els.roleCount.textContent = words.length
      ? visible + " of " + total + (total === 1 ? " role" : " roles")
      : total + (total === 1 ? " role" : " roles");
  }

  els.roleSearch.addEventListener("input", filterRoles);

  els.roleSearch.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.roleSearch.value) {
      e.preventDefault();
      els.roleSearchClear.click();
    }
  });

  els.roleSearchClear.addEventListener("click", () => {
    els.roleSearch.value = "";
    filterRoles();
    els.roleSearch.focus();
  });

  /* =========================================================
     Roles page: role detail (NEW)
     GET /api/roles/<role>?have=<your skills>
     Shows the skills to learn, plus the ones you already have.
     ========================================================= */
  let detailSeq = 0;

  function showBrowse() {
    detailSeq++; // ignore any detail request still in flight
    els.roleDetail.classList.add("hidden");
    els.rolesBrowse.classList.remove("hidden");
    state.detailRole = "";
  }

  function showDetailView() {
    els.rolesBrowse.classList.add("hidden");
    els.roleDetail.classList.remove("hidden");
  }

  function renderRoleDetail(data) {
    const skills = toList(data.skills);
    const hasUserSkills = Array.isArray(data.have) && Array.isArray(data.missing);
    const have = hasUserSkills ? toList(data.have) : [];
    const need = hasUserSkills ? toList(data.missing) : skills;

    els.roleDetailTitle.textContent = data.job_role || state.detailRole;
    els.roleDetailError.classList.add("hidden");
    els.roleDetailError.textContent = "";

    // "You already have" card (only when the user has added skills)
    els.roleHaveCard.classList.toggle("hidden", !hasUserSkills);
    els.roleHaveList.replaceChildren();
    if (hasUserSkills) {
      els.roleHaveCount.textContent = have.length + " of " + skills.length;
      if (!have.length) {
        els.roleHaveList.appendChild(
          h("p", "font-body-sm text-body-sm text-on-surface-variant", "None of your skills match this role yet.")
        );
      }
      have.forEach((s, i) => {
        const badge = stagger(h("div", "match-badge"), i);
        badge.appendChild(icon("check", "text-tertiary text-[15px]"));
        badge.appendChild(h("span", "", s));
        els.roleHaveList.appendChild(badge);
      });
    }

    // Skills to learn
    els.roleNeedHeading.textContent = hasUserSkills ? "Skills to learn" : "Skills required";
    els.roleNeedCount.textContent = need.length + (need.length === 1 ? " skill" : " skills");
    els.roleNeedList.replaceChildren();
    if (!need.length) {
      els.roleNeedList.appendChild(
        h("p", "font-body-sm text-body-sm text-tertiary", "Nothing to learn. You already have every skill for this role.")
      );
    }
    need.forEach((s, i) => {
      const item = stagger(h("div", "gap-item"), i);
      item.appendChild(h("span", "w-2 h-2 rounded-full bg-error shrink-0"));
      item.appendChild(h("span", "", s));
      els.roleNeedList.appendChild(item);
    });

    els.roleDetailSummary.textContent = hasUserSkills
      ? "You have " + have.length + " of the " + skills.length + " skills this role asks for."
      : skills.length + " skills are required. Add your skills on the Analyze page to see which ones you already have.";
  }

  async function openRoleDetail(role) {
    const mySeq = ++detailSeq;
    state.detailRole = role;

    // loading state
    els.roleDetailTitle.textContent = role;
    els.roleDetailSummary.textContent = "Loading skills...";
    els.roleHaveCard.classList.add("hidden");
    els.roleNeedList.replaceChildren();
    els.roleNeedCount.textContent = "";
    els.roleDetailError.classList.add("hidden");
    showDetailView();
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });

    let url = "/api/roles/" + encodeURIComponent(role);
    if (state.skills.length) url += "?have=" + encodeURIComponent(state.skills.join(", "));

    try {
      const res = await fetch(url);
      const data = await readJSON(res);
      if (mySeq !== detailSeq) return; // user went back or opened another role

      if (!res.ok || !data) {
        throw new Error((data && data.error) || "Could not load this role (" + res.status + ")");
      }
      renderRoleDetail(data);
      els.roleDetailTitle.focus({ preventScroll: true });
    } catch (err) {
      if (mySeq !== detailSeq) return;
      els.roleDetailSummary.textContent = "";
      els.roleDetailError.textContent = err.message || "Could not load this role.";
      els.roleDetailError.classList.remove("hidden");
    }
  }

  // Click a role card -> open its detail view
  els.rolesList.addEventListener("click", (e) => {
    const card = e.target.closest(".role-card");
    if (card && card.dataset.role) openRoleDetail(card.dataset.role);
  });

  els.roleBack.addEventListener("click", () => {
    showBrowse();
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  });

  // "Use as target role": set the select, then go to the Analyze page
  els.roleUseBtn.addEventListener("click", () => {
    const option = Array.from(els.role.options).find((o) => norm(o.value) === norm(state.detailRole));
    if (option) {
      els.role.value = option.value;
      els.role.dispatchEvent(new Event("change", { bubbles: true }));
    }
    showBrowse();
    if (typeof window.showPage === "function") window.showPage("analyze");
  });

  filterRoles(); // sets the initial "12 roles" count

  /* =========================================================
     Bottom nav
     Only tabs that open a page get the active style
     (Learning and Profile are placeholders). Tapping the Roles
     tab always returns to the role list.
     ========================================================= */
  const navLinks = els.nav.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.getAttribute("data-page");
      if (!page) return;

      navLinks.forEach((l) => {
        const active = l === link;
        l.classList.toggle("is-active", active);
        if (active) l.setAttribute("aria-current", "page");
        else l.removeAttribute("aria-current");
      });

      if (page === "roles") showBrowse();
    });
  });

  renderSkills();
})();