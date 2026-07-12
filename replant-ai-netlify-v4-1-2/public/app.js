const STORAGE = Object.freeze({
  profiles: "replant.profiles.v4",
  activeProfile: "replant.activeProfile.v4",
  history: "replant.history.v4",
  draft: "replant.draft.v4",
  aiEnabled: "replant.aiEnabled.v4",
  reduceMotion: "replant.reduceMotion.v4",
});

const MAX_HISTORY = 30;
const MAX_PROFILE_COUNT = 12;
const DEFAULT_PROFILE = Object.freeze({
  id: "profile-lena",
  name: "Lena",
  defaultMode: "vegan",
  defaultServings: 2,
  allergies: ["Soja"],
  dislikes: ["Auberginen"],
  cuisines: ["Italienisch", "Asiatisch"],
  favorites: ["Knoblauch", "Zitrone", "Basilikum"],
  notes: "",
});

const EXAMPLE_RECIPE = `Spaghetti Carbonara

Portionen: 4

Zutaten
400 g Spaghetti
200 g Pancetta oder Speck, gewürfelt
4 Eier
100 g Parmesan, fein gerieben
1 EL Olivenöl
Salz
Schwarzer Pfeffer

Zubereitung
1. Spaghetti in Salzwasser al dente kochen und etwas Kochwasser aufheben.
2. Pancetta mit Olivenöl knusprig braten.
3. Eier mit Parmesan und schwarzem Pfeffer verquirlen.
4. Die heißen Spaghetti zur Pancetta geben und die Pfanne vom Herd nehmen.
5. Eiermischung einarbeiten und mit Kochwasser cremig rühren.
6. Sofort servieren.`;

const ids = [
  "aiDialog", "aiInlineToggle", "aiSettingsButton", "aiSettingsStatus",
  "characterCount", "clearHistoryButton", "clearSourceButton", "confirmDialog", "confirmDialogText", "confirmDialogTitle", "conversionStatus",
  "convertButton", "copyButton", "deleteHistoryItemButton", "dietRange", "editProfileButton", "editProfileFooterButton", "engineBadge", "exampleButton",
  "exportDataButton", "favoriteButton", "favoriteCount", "favoritesEmpty", "favoritesList", "fidelityInfoButton", "fidelityLabel", "fidelityRange",
  "fidelityScore", "historyEmpty", "historyList", "importButton", "importDataButton", "importDataInput", "infoDialog", "ingredientList", "linkPanel",
  "linkTab", "loadHistoryItemButton", "mobileAvatar", "mobileProfileButton", "motionToggle", "printButton", "profileAllergies", "profileCuisineInput",
  "profileCuisines", "profileDefaultMode", "profileDefaultServings", "profileDialog", "profileDialogTitle", "profileDislikeInput", "profileDislikes",
  "profileFavoriteInput", "profileFavorites", "profileForm", "profileGrid", "profileId", "profileName", "profileNotes", "profileSelect", "profileSelectLabel",
  "profileSwitcher", "profileAllergyInput", "rangeLeaf", "recipeDialog", "recipeDialogContent", "recipeDialogTitle", "recipeText", "recipeUrl", "recheckAiButton",
  "resetDataButton", "resultCard", "resultEyebrow", "resultSummary", "resultTitle", "servingsLabel", "servingsSelect", "sourceNotice", "sourceNoticeMeta",
  "sourceNoticeTitle", "stepList", "textPanel", "textTab", "tipList", "toastRegion", "warningDetails", "warningList", "changeList", "changeEmpty",
  "quantityChangeList", "quantityChangeEmpty", "activeAvatar", "activeProfileName", "addProfileButton",
];

const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

const state = {
  activeView: "start",
  inputMode: "link",
  profiles: loadProfiles(),
  activeProfileId: localStorage.getItem(STORAGE.activeProfile) || DEFAULT_PROFILE.id,
  history: loadHistory(),
  currentResult: null,
  importedText: "",
  importedSourceUrl: "",
  aiAvailable: false,
  aiEnabled: localStorage.getItem(STORAGE.aiEnabled) === "true",
  selectedHistoryId: null,
  reduceMotion: localStorage.getItem(STORAGE.reduceMotion) === "true",
};

if (!state.profiles.some((profile) => profile.id === state.activeProfileId)) {
  state.activeProfileId = state.profiles[0].id;
}

init();

function init() {
  populateServingOptions();
  restoreDraft();
  bindEvents();
  applyMotionPreference();
  renderProfilesEverywhere();
  updateDietControl(activeProfile().defaultMode);
  el.servingsSelect.value = String(activeProfile().defaultServings || 2);
  updateServingsLabel();
  updateFidelityControl();
  updateCharacterCount();
  renderHistory();
  renderFavorites();
  renderProfileGrid();
  renderAiState();
  checkAiStatus();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll("[data-go-start]").forEach((button) => {
    button.addEventListener("click", () => switchView("start"));
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(document.getElementById(button.dataset.closeDialog)));
  });

  document.querySelectorAll(".input-tab").forEach((tab) => {
    tab.addEventListener("click", () => setInputMode(tab.dataset.inputMode));
    tab.addEventListener("keydown", handleTabKeydown);
  });

  el.recipeText.addEventListener("input", () => {
    updateCharacterCount();
    saveDraft();
  });
  el.recipeUrl.addEventListener("input", saveDraft);
  el.recipeUrl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      importFromUrl();
    }
  });
  el.importButton.addEventListener("click", importFromUrl);
  el.exampleButton.addEventListener("click", loadExample);
  el.clearSourceButton.addEventListener("click", clearImportedSource);

  el.dietRange.addEventListener("input", () => updateDietControl(Number(el.dietRange.value) === 1 ? "vegan" : "vegetarian"));
  el.profileSelect.addEventListener("change", () => setActiveProfile(el.profileSelect.value, true));
  el.servingsSelect.addEventListener("change", updateServingsLabel);
  el.fidelityRange.addEventListener("input", updateFidelityControl);
  el.fidelityInfoButton.addEventListener("click", () => openDialog(el.infoDialog));

  el.convertButton.addEventListener("click", convertRecipe);
  el.favoriteButton.addEventListener("click", toggleCurrentFavorite);
  el.copyButton.addEventListener("click", copyCurrentRecipe);
  el.printButton.addEventListener("click", () => window.print());

  el.profileSwitcher.addEventListener("click", () => switchView("profiles"));
  el.mobileProfileButton.addEventListener("click", () => switchView("profiles"));
  el.editProfileButton.addEventListener("click", () => openProfileDialog(activeProfile()));
  el.editProfileFooterButton.addEventListener("click", () => openProfileDialog(activeProfile()));
  el.addProfileButton.addEventListener("click", () => openProfileDialog());
  el.profileForm.addEventListener("submit", saveProfileFromDialog);

  el.aiInlineToggle.addEventListener("click", toggleAi);
  el.aiSettingsButton.addEventListener("click", toggleAi);
  el.recheckAiButton.addEventListener("click", checkAiStatus);

  el.motionToggle.addEventListener("click", () => {
    state.reduceMotion = !state.reduceMotion;
    localStorage.setItem(STORAGE.reduceMotion, String(state.reduceMotion));
    applyMotionPreference();
    showToast(state.reduceMotion ? "Animationen wurden reduziert." : "Animationen sind wieder aktiv.");
  });

  el.clearHistoryButton.addEventListener("click", clearHistory);
  el.exportDataButton.addEventListener("click", exportData);
  el.importDataButton.addEventListener("click", () => el.importDataInput.click());
  el.importDataInput.addEventListener("change", importData);
  el.resetDataButton.addEventListener("click", resetAllData);

  el.loadHistoryItemButton.addEventListener("click", loadSelectedHistoryItem);
  el.deleteHistoryItemButton.addEventListener("click", deleteSelectedHistoryItem);

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-history-id]");
    if (openButton) openHistoryDialog(openButton.dataset.openHistoryId);
    const heartButton = event.target.closest("[data-toggle-favorite-id]");
    if (heartButton) {
      event.stopPropagation();
      toggleHistoryFavorite(heartButton.dataset.toggleFavoriteId);
    }
    const profileAction = event.target.closest("[data-profile-action]");
    if (profileAction) handleProfileAction(profileAction);
  });

  window.addEventListener("beforeunload", saveDraft);
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function loadProfiles() {
  const raw = safeParse(localStorage.getItem(STORAGE.profiles), []);
  const profiles = Array.isArray(raw) ? raw.map(sanitizeProfile).filter(Boolean).slice(0, MAX_PROFILE_COUNT) : [];
  return profiles.length ? profiles : [{ ...DEFAULT_PROFILE }];
}

function loadHistory() {
  const raw = safeParse(localStorage.getItem(STORAGE.history), []);
  return Array.isArray(raw) ? raw.map(sanitizeHistoryEntry).filter(Boolean).slice(0, MAX_HISTORY) : [];
}

function sanitizeProfile(value) {
  if (!value || typeof value !== "object") return null;
  const name = cleanText(value.name, 40) || "Profil";
  return {
    id: cleanText(value.id, 80) || makeId("profile"),
    name,
    defaultMode: value.defaultMode === "vegetarian" ? "vegetarian" : "vegan",
    defaultServings: clampInt(value.defaultServings, 1, 12, 2),
    allergies: cleanList(value.allergies, 16),
    dislikes: cleanList(value.dislikes, 16),
    cuisines: cleanList(value.cuisines, 16),
    favorites: cleanList(value.favorites, 20),
    notes: cleanText(value.notes, 1000),
  };
}

function sanitizeHistoryEntry(value) {
  if (!value || typeof value !== "object" || !value.recipe) return null;
  const recipe = normalizeRecipe(value.recipe);
  if (!recipe.title) return null;
  return {
    id: cleanText(value.id, 100) || makeId("recipe"),
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now(),
    profileName: cleanText(value.profileName, 40) || "Profil",
    engine: value.engine === "ai" ? "ai" : "fallback",
    favorite: Boolean(value.favorite),
    recipe,
  };
}

function cleanText(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanList(value, maxItems = 20) {
  const items = Array.isArray(value) ? value : splitCsv(value);
  return [...new Set(items.map((item) => cleanText(item, 80)).filter(Boolean))].slice(0, maxItems);
}

function splitCsv(value) {
  return String(value ?? "").split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

function populateServingOptions() {
  const fragment = document.createDocumentFragment();
  const profileFragment = document.createDocumentFragment();
  for (let number = 1; number <= 12; number += 1) {
    const option = new Option(`${number} ${number === 1 ? "Portion" : "Portionen"}`, String(number));
    fragment.append(option);
    profileFragment.append(option.cloneNode(true));
  }
  el.servingsSelect.replaceChildren(fragment);
  el.profileDefaultServings.replaceChildren(profileFragment);
}

function restoreDraft() {
  const draft = safeParse(localStorage.getItem(STORAGE.draft), {});
  if (!draft || typeof draft !== "object") return;
  el.recipeUrl.value = String(draft.url || "").slice(0, 2048);
  el.recipeText.value = String(draft.text || "").slice(0, 50000);
  const mode = draft.inputMode === "text" ? "text" : "link";
  setInputMode(mode, false);
}

function saveDraft() {
  localStorage.setItem(STORAGE.draft, JSON.stringify({
    url: el.recipeUrl.value.slice(0, 2048),
    text: el.recipeText.value.slice(0, 50000),
    inputMode: state.inputMode,
  }));
}

function handleTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "ArrowLeft" || event.key === "Home" ? "link" : "text";
  setInputMode(next);
  (next === "link" ? el.linkTab : el.textTab).focus();
}

function setInputMode(mode, persist = true) {
  state.inputMode = mode === "text" ? "text" : "link";
  const linkActive = state.inputMode === "link";
  el.linkTab.classList.toggle("is-active", linkActive);
  el.textTab.classList.toggle("is-active", !linkActive);
  el.linkTab.setAttribute("aria-selected", String(linkActive));
  el.textTab.setAttribute("aria-selected", String(!linkActive));
  el.linkTab.tabIndex = linkActive ? 0 : -1;
  el.textTab.tabIndex = linkActive ? -1 : 0;
  el.linkPanel.hidden = !linkActive;
  el.textPanel.hidden = linkActive;
  el.linkPanel.classList.toggle("is-active", linkActive);
  el.textPanel.classList.toggle("is-active", !linkActive);
  if (persist) saveDraft();
}

function updateCharacterCount() {
  el.characterCount.textContent = `${new Intl.NumberFormat("de-DE").format(el.recipeText.value.length)} / 50.000`;
}

function loadExample() {
  el.recipeText.value = EXAMPLE_RECIPE;
  state.importedText = "";
  state.importedSourceUrl = "";
  el.sourceNotice.hidden = true;
  updateCharacterCount();
  saveDraft();
  showToast("Beispielrezept wurde geladen.");
  el.recipeText.focus();
}

async function importFromUrl({ silent = false } = {}) {
  const url = el.recipeUrl.value.trim();
  let parsed;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    setStatus("Bitte füge eine vollständige öffentliche http- oder https-Adresse ein.", true);
    el.recipeUrl.focus();
    return false;
  }

  setBusy(el.importButton, true, "Lese …");
  if (!silent) setStatus("Rezeptseite wird gelesen …");
  try {
    const data = await requestJson("/api/import", {
      method: "POST",
      body: JSON.stringify({ url }),
    }, 15000);
    if (!data.recipe?.text) throw new Error("Auf dieser Seite wurde kein lesbarer Rezepttext gefunden.");
    state.importedText = String(data.recipe.text).slice(0, 50000);
    state.importedSourceUrl = String(data.recipe.sourceUrl || url).slice(0, 2048);
    el.sourceNoticeTitle.textContent = data.recipe.title || "Rezept erkannt";
    el.sourceNoticeMeta.textContent = data.recipe.structured
      ? "Strukturierte Rezeptdaten wurden übernommen."
      : "Sichtbarer Seitentext wurde übernommen – bitte kurz kontrollieren.";
    el.sourceNotice.hidden = false;
    setStatus("Rezept ist bereit zur Umwandlung.");
    showToast("Rezept wurde erfolgreich eingelesen.");
    return true;
  } catch (error) {
    clearImportedSource(false);
    setStatus(error.message || "Der Link konnte nicht gelesen werden.", true);
    if (!silent) showToast(error.message || "Linkimport fehlgeschlagen.", true);
    return false;
  } finally {
    setBusy(el.importButton, false, "Einfügen");
  }
}

function clearImportedSource(clearUrl = true) {
  state.importedText = "";
  state.importedSourceUrl = "";
  el.sourceNotice.hidden = true;
  if (clearUrl) {
    el.recipeUrl.value = "";
    saveDraft();
  }
}

function updateDietControl(mode) {
  const vegan = mode === "vegan";
  el.dietRange.value = vegan ? "1" : "0";
  el.dietRange.setAttribute("aria-valuetext", vegan ? "Vegan" : "Vegetarisch");
  el.dietRange.style.setProperty("--range-progress", vegan ? "100%" : "0%");
}

function updateServingsLabel() {
  const number = clampInt(el.servingsSelect.value, 1, 12, 2);
  el.servingsLabel.textContent = `${number} ${number === 1 ? "Portion" : "Portionen"}`;
}

function updateFidelityControl() {
  const value = clampInt(el.fidelityRange.value, 0, 100, 50);
  const label = value <= 28 ? "Sehr nah" : value >= 72 ? "Kreativ" : "Ausgewogen";
  el.fidelityRange.style.setProperty("--range-progress", `${value}%`);
  el.rangeLeaf.style.setProperty("--range-progress", `${value}%`);
  el.fidelityLabel.textContent = label;
  el.fidelityRange.setAttribute("aria-valuetext", label);
}

async function convertRecipe() {
  let recipeText = state.inputMode === "link" ? state.importedText : el.recipeText.value.trim();
  if (state.inputMode === "link" && !recipeText) {
    if (!el.recipeUrl.value.trim()) {
      setStatus("Füge zuerst einen Rezeptlink ein.", true);
      el.recipeUrl.focus();
      return;
    }
    const imported = await importFromUrl({ silent: true });
    if (!imported) return;
    recipeText = state.importedText;
  }
  if (!recipeText || recipeText.length < 30) {
    setStatus("Der Rezepttext ist noch zu kurz. Füge Zutaten und Zubereitung ein.", true);
    if (state.inputMode === "text") el.recipeText.focus();
    return;
  }

  const profile = activeProfile();
  const mode = Number(el.dietRange.value) === 1 ? "vegan" : "vegetarian";
  const useAi = state.aiAvailable && state.aiEnabled;
  setBusy(el.convertButton, true, useAi ? "AI verwandelt …" : "RePlant verwandelt …");
  setStatus(useAi ? "AI analysiert Geschmack, Textur und Zubereitung …" : "Grundmodus ersetzt die wichtigsten Tierprodukte …");

  try {
    const data = await requestJson("/api/convert", {
      method: "POST",
      body: JSON.stringify({
        recipeText,
        sourceUrl: state.inputMode === "link" ? state.importedSourceUrl : "",
        mode,
        servings: clampInt(el.servingsSelect.value, 1, 12, profile.defaultServings),
        fidelity: clampInt(el.fidelityRange.value, 0, 100, 50),
        profile,
        useAi,
      }),
    }, useAi ? 40000 : 15000);

    const recipe = normalizeRecipe(data.recipe);
    if (!recipe.title || !recipe.ingredients.length || !recipe.steps.length) {
      throw new Error("Die Umwandlung war unvollständig. Bitte versuche es erneut.");
    }
    const entry = {
      id: makeId("recipe"),
      createdAt: Date.now(),
      profileName: profile.name,
      engine: data.engine === "ai" ? "ai" : "fallback",
      favorite: false,
      recipe,
    };
    state.currentResult = entry;
    state.history = [entry, ...state.history].slice(0, MAX_HISTORY);
    persistHistory();
    renderResult(entry);
    renderHistory();
    renderFavorites();
    setStatus(data.engine === "ai" ? "AI-Umwandlung abgeschlossen." : "Grundversion abgeschlossen – Angaben bitte kurz prüfen.");
    el.resultCard.hidden = false;
    requestAnimationFrame(() => el.resultCard.scrollIntoView({ behavior: state.reduceMotion ? "auto" : "smooth", block: "start" }));
  } catch (error) {
    setStatus(error.message || "Die Umwandlung ist fehlgeschlagen.", true);
    showToast(error.message || "Umwandlung fehlgeschlagen.", true);
  } finally {
    setBusy(el.convertButton, false, "Rezept verwandeln");
  }
}

function normalizeRecipe(value) {
  const source = value && typeof value === "object" ? value : {};
  const ingredients = Array.isArray(source.ingredients) ? source.ingredients.map((entry) => {
    if (typeof entry === "string") return { amount: "", item: cleanText(entry, 300), note: "" };
    return {
      amount: cleanText(entry?.amount, 60),
      item: cleanText(entry?.item, 240),
      note: cleanText(entry?.note, 240),
    };
  }).filter((entry) => entry.item).slice(0, 100) : [];
  const steps = Array.isArray(source.steps) ? source.steps.map((entry) => cleanText(typeof entry === "string" ? entry : entry?.text, 1200)).filter(Boolean).slice(0, 60) : [];
  const changes = Array.isArray(source.changes) ? source.changes.map((entry) => ({
    from: cleanText(entry?.from, 200),
    to: cleanText(entry?.to, 200),
    reason: cleanText(entry?.reason, 300),
  })).filter((entry) => entry.from || entry.to).slice(0, 30) : [];
  const quantityChanges = Array.isArray(source.quantityChanges) ? source.quantityChanges.map((entry) => ({
    ingredient: cleanText(entry?.ingredient, 240),
    from: cleanText(entry?.from, 60),
    to: cleanText(entry?.to, 60),
  })).filter((entry) => entry.ingredient && entry.from && entry.to && entry.from !== entry.to).slice(0, 100) : [];
  return {
    title: cleanText(source.title, 180),
    summary: cleanText(source.summary, 500),
    mode: source.mode === "vegetarian" ? "vegetarian" : "vegan",
    servings: clampInt(source.servings, 1, 24, 2),
    fidelityScore: clampInt(source.fidelityScore, 0, 100, 70),
    ingredients,
    steps,
    changes,
    quantityChanges,
    warnings: cleanList(source.warnings, 30),
    tips: cleanList(source.tips, 30),
    sourceUrl: cleanText(source.sourceUrl, 2048),
  };
}

function renderResult(entry) {
  const { recipe } = entry;
  el.resultEyebrow.textContent = recipe.mode === "vegan" ? "Vegane Variante" : "Vegetarische Variante";
  el.resultTitle.textContent = recipe.title;
  el.resultSummary.textContent = recipe.summary || `Für ${recipe.servings} ${recipe.servings === 1 ? "Portion" : "Portionen"}.`;
  el.fidelityScore.textContent = String(recipe.fidelityScore);
  el.engineBadge.textContent = entry.engine === "ai" ? "RePlant AI" : "Regelbasierter Grundmodus";
  el.favoriteButton.setAttribute("aria-pressed", String(entry.favorite));
  el.favoriteButton.lastChild.textContent = entry.favorite ? " Gespeichert" : " Favorit";

  el.ingredientList.replaceChildren(...recipe.ingredients.map((ingredient) => {
    const li = document.createElement("li");
    const amount = document.createElement("span");
    amount.className = "amount";
    amount.textContent = ingredient.amount || "–";
    const copy = document.createElement("span");
    copy.textContent = ingredient.item;
    if (ingredient.note) {
      const note = document.createElement("small");
      note.className = "ingredient-note";
      note.textContent = ingredient.note;
      copy.append(note);
    }
    li.append(amount, copy);
    return li;
  }));

  el.stepList.replaceChildren(...recipe.steps.map((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    return li;
  }));

  el.changeList.replaceChildren(...recipe.changes.map((change) => {
    const row = document.createElement("div");
    row.className = "change-item";
    const from = document.createElement("span");
    from.textContent = change.from || "Original";
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    const to = document.createElement("span");
    to.textContent = change.reason ? `${change.to} – ${change.reason}` : change.to;
    row.append(from, arrow, to);
    return row;
  }));
  el.changeEmpty.hidden = recipe.changes.length > 0;

  el.quantityChangeList.replaceChildren(...recipe.quantityChanges.map((change) => {
    const row = document.createElement("div");
    row.className = "quantity-change-item";
    const ingredient = document.createElement("strong");
    ingredient.textContent = change.ingredient;
    const from = document.createElement("span");
    from.className = "quantity-from";
    from.textContent = change.from;
    const arrow = document.createElement("span");
    arrow.textContent = "→";
    const to = document.createElement("span");
    to.textContent = change.to;
    row.append(ingredient, from, arrow, to);
    return row;
  }));
  el.quantityChangeEmpty.hidden = recipe.quantityChanges.length > 0;

  el.warningList.replaceChildren(...recipe.warnings.map(makeListItem));
  el.tipList.replaceChildren(...recipe.tips.map(makeListItem));
  el.warningDetails.open = recipe.warnings.length > 0;
  el.resultCard.hidden = false;
}

function makeListItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function toggleCurrentFavorite() {
  if (!state.currentResult) return;
  const id = state.currentResult.id;
  state.currentResult.favorite = !state.currentResult.favorite;
  const index = state.history.findIndex((entry) => entry.id === id);
  if (index >= 0) state.history[index].favorite = state.currentResult.favorite;
  persistHistory();
  renderResult(state.currentResult);
  renderHistory();
  renderFavorites();
  showToast(state.currentResult.favorite ? "Rezept wurde gespeichert." : "Rezept wurde aus Favoriten entfernt.");
}

function toggleHistoryFavorite(id) {
  const entry = state.history.find((item) => item.id === id);
  if (!entry) return;
  entry.favorite = !entry.favorite;
  if (state.currentResult?.id === id) state.currentResult.favorite = entry.favorite;
  persistHistory();
  renderHistory();
  renderFavorites();
  if (state.currentResult?.id === id) renderResult(state.currentResult);
}

async function copyCurrentRecipe() {
  if (!state.currentResult) return;
  const text = recipeToText(state.currentResult.recipe);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  showToast("Rezept wurde kopiert.");
}

function recipeToText(recipe) {
  const lines = [recipe.title, "", `${recipe.servings} ${recipe.servings === 1 ? "Portion" : "Portionen"}`, "", "Zutaten"];
  for (const ingredient of recipe.ingredients) {
    lines.push([ingredient.amount, ingredient.item, ingredient.note ? `(${ingredient.note})` : ""].filter(Boolean).join(" "));
  }
  lines.push("", "Zubereitung");
  recipe.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  if (recipe.warnings.length) lines.push("", "Hinweise", ...recipe.warnings.map((warning) => `- ${warning}`));
  return lines.join("\n");
}

function renderProfilesEverywhere() {
  const profile = activeProfile();
  const fragment = document.createDocumentFragment();
  for (const item of state.profiles) fragment.append(new Option(item.name, item.id, false, item.id === profile.id));
  el.profileSelect.replaceChildren(fragment);
  el.profileSelect.value = profile.id;
  el.profileSelectLabel.textContent = profile.name;
  el.activeProfileName.textContent = profile.name;
  el.profileAllergies.textContent = displayList(profile.allergies, "Keine hinterlegt");
  el.profileDislikes.textContent = displayList(profile.dislikes, "Keine hinterlegt");
  el.profileCuisines.textContent = displayList(profile.cuisines, "Keine hinterlegt");
  el.profileFavorites.textContent = displayList(profile.favorites, "Keine hinterlegt");
  updateAvatar(el.activeAvatar, profile);
  updateAvatar(el.mobileAvatar, profile);
  localStorage.setItem(STORAGE.profiles, JSON.stringify(state.profiles));
  localStorage.setItem(STORAGE.activeProfile, profile.id);
}

function displayList(items, fallback) {
  return items.length ? items.join(", ") : fallback;
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
}

function setActiveProfile(id, applyDefaults = false) {
  const profile = state.profiles.find((item) => item.id === id);
  if (!profile) return;
  state.activeProfileId = profile.id;
  renderProfilesEverywhere();
  if (applyDefaults) {
    updateDietControl(profile.defaultMode);
    el.servingsSelect.value = String(profile.defaultServings);
    updateServingsLabel();
  }
  renderProfileGrid();
}

function updateAvatar(target, profile) {
  const hue = hashString(profile.name) % 90 + 65;
  target.textContent = profile.name.slice(0, 1).toUpperCase();
  target.style.setProperty("--avatar-hue", String(hue));
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function openProfileDialog(profile = null) {
  const isEdit = Boolean(profile);
  const value = profile || {
    id: "",
    name: "",
    defaultMode: "vegan",
    defaultServings: 2,
    allergies: [],
    dislikes: [],
    cuisines: [],
    favorites: [],
    notes: "",
  };
  el.profileDialogTitle.textContent = isEdit ? "Profil bearbeiten" : "Neues Profil";
  el.profileId.value = value.id;
  el.profileName.value = value.name;
  el.profileDefaultMode.value = value.defaultMode;
  el.profileDefaultServings.value = String(value.defaultServings);
  el.profileAllergyInput.value = value.allergies.join(", ");
  el.profileDislikeInput.value = value.dislikes.join(", ");
  el.profileCuisineInput.value = value.cuisines.join(", ");
  el.profileFavoriteInput.value = value.favorites.join(", ");
  el.profileNotes.value = value.notes;
  openDialog(el.profileDialog);
  requestAnimationFrame(() => el.profileName.focus());
}

function saveProfileFromDialog(event) {
  event.preventDefault();
  const id = el.profileId.value || makeId("profile");
  const profile = sanitizeProfile({
    id,
    name: el.profileName.value,
    defaultMode: el.profileDefaultMode.value,
    defaultServings: el.profileDefaultServings.value,
    allergies: splitCsv(el.profileAllergyInput.value),
    dislikes: splitCsv(el.profileDislikeInput.value),
    cuisines: splitCsv(el.profileCuisineInput.value),
    favorites: splitCsv(el.profileFavoriteInput.value),
    notes: el.profileNotes.value,
  });
  if (!profile.name) {
    el.profileName.focus();
    return;
  }
  const index = state.profiles.findIndex((item) => item.id === id);
  if (index >= 0) state.profiles[index] = profile;
  else {
    if (state.profiles.length >= MAX_PROFILE_COUNT) {
      showToast(`Maximal ${MAX_PROFILE_COUNT} Profile sind möglich.`, true);
      return;
    }
    state.profiles.push(profile);
  }
  state.activeProfileId = profile.id;
  closeDialog(el.profileDialog);
  renderProfilesEverywhere();
  renderProfileGrid();
  updateDietControl(profile.defaultMode);
  el.servingsSelect.value = String(profile.defaultServings);
  updateServingsLabel();
  showToast("Profil wurde gespeichert.");
}

function renderProfileGrid() {
  const cards = state.profiles.map((profile) => {
    const article = document.createElement("article");
    article.className = "profile-card";
    if (profile.id === state.activeProfileId) article.dataset.active = "true";

    const head = document.createElement("div");
    head.className = "profile-card-head";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    updateAvatar(avatar, profile);
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = profile.name;
    const meta = document.createElement("small");
    meta.textContent = profile.id === state.activeProfileId ? "Aktives Profil" : `${profile.defaultServings} Portionen · ${profile.defaultMode === "vegan" ? "Vegan" : "Vegetarisch"}`;
    copy.append(name, meta);
    head.append(avatar, copy);

    const tags = document.createElement("div");
    tags.className = "profile-card-tags";
    const tagValues = [...profile.allergies.map((item) => `Ohne ${item}`), ...profile.cuisines].slice(0, 5);
    if (!tagValues.length) tagValues.push("Noch keine Angaben");
    tags.append(...tagValues.map((value) => {
      const tag = document.createElement("span");
      tag.textContent = value;
      return tag;
    }));

    const actions = document.createElement("div");
    actions.className = "profile-card-actions";
    const activate = document.createElement("button");
    activate.type = "button";
    activate.className = "soft-button";
    activate.dataset.profileAction = "activate";
    activate.dataset.profileId = profile.id;
    activate.textContent = profile.id === state.activeProfileId ? "Aktiv" : "Auswählen";
    activate.disabled = profile.id === state.activeProfileId;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "soft-button";
    edit.dataset.profileAction = "edit";
    edit.dataset.profileId = profile.id;
    edit.textContent = "Bearbeiten";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "soft-button danger";
    remove.dataset.profileAction = "delete";
    remove.dataset.profileId = profile.id;
    remove.textContent = "Löschen";
    remove.disabled = state.profiles.length === 1;
    actions.append(activate, edit, remove);
    article.append(head, tags, actions);
    return article;
  });
  el.profileGrid.replaceChildren(...cards);
}

async function handleProfileAction(button) {
  const profile = state.profiles.find((item) => item.id === button.dataset.profileId);
  if (!profile) return;
  const action = button.dataset.profileAction;
  if (action === "activate") {
    setActiveProfile(profile.id, true);
    showToast(`${profile.name} ist jetzt aktiv.`);
  } else if (action === "edit") {
    openProfileDialog(profile);
  } else if (action === "delete" && state.profiles.length > 1) {
    const confirmed = await askConfirm("Profil löschen?", `„${profile.name}“ und alle darin gespeicherten Vorlieben werden entfernt.`);
    if (!confirmed) return;
    state.profiles = state.profiles.filter((item) => item.id !== profile.id);
    if (state.activeProfileId === profile.id) state.activeProfileId = state.profiles[0].id;
    renderProfilesEverywhere();
    renderProfileGrid();
    showToast("Profil wurde gelöscht.");
  }
}

function renderHistory() {
  const entries = state.history;
  el.historyList.replaceChildren(...entries.map(makeCollectionCard));
  el.historyEmpty.hidden = entries.length > 0;
  el.historyList.hidden = entries.length === 0;
  updateFavoriteCount();
}

function renderFavorites() {
  const entries = state.history.filter((entry) => entry.favorite);
  el.favoritesList.replaceChildren(...entries.map(makeCollectionCard));
  el.favoritesEmpty.hidden = entries.length > 0;
  el.favoritesList.hidden = entries.length === 0;
  updateFavoriteCount();
}

function makeCollectionCard(entry) {
  const article = document.createElement("article");
  article.className = "collection-card";
  const top = document.createElement("div");
  top.className = "collection-card-top";
  const date = document.createElement("span");
  date.textContent = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(entry.createdAt);
  const heart = document.createElement("button");
  heart.type = "button";
  heart.className = "card-heart";
  heart.dataset.toggleFavoriteId = entry.id;
  heart.setAttribute("aria-pressed", String(entry.favorite));
  heart.setAttribute("aria-label", entry.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen");
  heart.append(makeHeartSvg());
  top.append(date, heart);

  const title = document.createElement("h2");
  title.textContent = entry.recipe.title;
  const summary = document.createElement("p");
  summary.textContent = entry.recipe.summary || `${entry.recipe.servings} Portionen`;
  const meta = document.createElement("div");
  meta.className = "card-meta";
  for (const value of [entry.recipe.mode === "vegan" ? "Vegan" : "Vegetarisch", entry.engine === "ai" ? "RePlant AI" : "Grundmodus", `${entry.recipe.fidelityScore}% nah`]) {
    const badge = document.createElement("span");
    badge.textContent = value;
    meta.append(badge);
  }
  const open = document.createElement("button");
  open.type = "button";
  open.className = "card-open";
  open.dataset.openHistoryId = entry.id;
  open.setAttribute("aria-label", `${entry.recipe.title} öffnen`);
  article.append(top, title, summary, meta, open);
  return article;
}

function makeHeartSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-.9-.9a5.6 5.6 0 1 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z");
  svg.append(path);
  return svg;
}

function persistHistory() {
  localStorage.setItem(STORAGE.history, JSON.stringify(state.history.slice(0, MAX_HISTORY)));
  updateFavoriteCount();
}

function updateFavoriteCount() {
  const count = state.history.filter((entry) => entry.favorite).length;
  el.favoriteCount.textContent = String(count);
  el.favoriteCount.hidden = count === 0;
}

function openHistoryDialog(id) {
  const entry = state.history.find((item) => item.id === id);
  if (!entry) return;
  state.selectedHistoryId = id;
  el.recipeDialogTitle.textContent = entry.recipe.title;
  el.recipeDialogContent.replaceChildren(makeRecipeDialogContent(entry));
  openDialog(el.recipeDialog);
}

function makeRecipeDialogContent(entry) {
  const wrapper = document.createElement("div");
  const meta = document.createElement("p");
  meta.className = "subtle-note";
  meta.textContent = `${entry.recipe.mode === "vegan" ? "Vegan" : "Vegetarisch"} · ${entry.recipe.servings} Portionen · ${entry.engine === "ai" ? "RePlant AI" : "Grundmodus"}`;
  const ingredientsTitle = document.createElement("h3");
  ingredientsTitle.textContent = "Zutaten";
  const ingredients = document.createElement("ul");
  ingredients.append(...entry.recipe.ingredients.map((item) => makeListItem([item.amount, item.item, item.note ? `(${item.note})` : ""].filter(Boolean).join(" "))));
  const stepsTitle = document.createElement("h3");
  stepsTitle.textContent = "Zubereitung";
  const steps = document.createElement("ol");
  steps.append(...entry.recipe.steps.map(makeListItem));
  wrapper.append(meta, ingredientsTitle, ingredients, stepsTitle, steps);
  return wrapper;
}

function loadSelectedHistoryItem() {
  const entry = state.history.find((item) => item.id === state.selectedHistoryId);
  if (!entry) return;
  state.currentResult = entry;
  renderResult(entry);
  closeDialog(el.recipeDialog);
  switchView("start");
  requestAnimationFrame(() => el.resultCard.scrollIntoView({ behavior: state.reduceMotion ? "auto" : "smooth", block: "start" }));
}

async function deleteSelectedHistoryItem() {
  const entry = state.history.find((item) => item.id === state.selectedHistoryId);
  if (!entry) return;
  const confirmed = await askConfirm("Rezept löschen?", `„${entry.recipe.title}“ wird aus Verlauf und Favoriten entfernt.`);
  if (!confirmed) return;
  state.history = state.history.filter((item) => item.id !== entry.id);
  if (state.currentResult?.id === entry.id) {
    state.currentResult = null;
    el.resultCard.hidden = true;
  }
  persistHistory();
  renderHistory();
  renderFavorites();
  closeDialog(el.recipeDialog);
  showToast("Rezept wurde gelöscht.");
}

async function clearHistory() {
  if (!state.history.length) return;
  const confirmed = await askConfirm("Verlauf leeren?", "Alle gespeicherten Ergebnisse und Favoriten werden aus diesem Browser gelöscht.");
  if (!confirmed) return;
  state.history = [];
  state.currentResult = null;
  el.resultCard.hidden = true;
  persistHistory();
  renderHistory();
  renderFavorites();
  showToast("Verlauf wurde geleert.");
}

function switchView(view) {
  const valid = ["start", "history", "favorites", "profiles", "settings"];
  state.activeView = valid.includes(view) ? view : "start";
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const active = panel.dataset.viewPanel === state.activeView;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === state.activeView;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (state.activeView === "history") renderHistory();
  if (state.activeView === "favorites") renderFavorites();
  if (state.activeView === "profiles") renderProfileGrid();
  window.scrollTo({ top: 0, behavior: state.reduceMotion ? "auto" : "smooth" });
}

async function checkAiStatus() {
  try {
    const data = await requestJson("/api/health", { method: "GET" }, 8000);
    state.aiAvailable = Boolean(data.aiAvailable);
    if (!state.aiAvailable) state.aiEnabled = false;
    localStorage.setItem(STORAGE.aiEnabled, String(state.aiEnabled));
    renderAiState();
    if (el.aiDialog.open && state.aiAvailable) showToast("AI ist jetzt bereit.");
  } catch {
    state.aiAvailable = false;
    state.aiEnabled = false;
    renderAiState();
  }
}

function toggleAi() {
  if (!state.aiAvailable) {
    openDialog(el.aiDialog);
    return;
  }
  state.aiEnabled = !state.aiEnabled;
  localStorage.setItem(STORAGE.aiEnabled, String(state.aiEnabled));
  renderAiState();
  showToast(state.aiEnabled ? "AI ist für neue Umwandlungen aktiv." : "AI wurde ausgeschaltet.");
}

function renderAiState() {
  const enabled = state.aiAvailable && state.aiEnabled;
  el.aiInlineToggle.setAttribute("aria-checked", String(enabled));
  el.aiInlineToggle.setAttribute("aria-label", enabled ? "AI-Modus ausschalten" : "AI-Modus aktivieren");
  el.aiInlineToggle.classList.toggle("is-unavailable", !state.aiAvailable);
  if (enabled) {
    el.aiSettingsStatus.textContent = "Aktiv";
    el.aiSettingsStatus.className = "status-pill is-on";
    el.aiSettingsButton.textContent = "AI ausschalten";
  } else if (state.aiAvailable) {
    el.aiSettingsStatus.textContent = "Bereit, derzeit aus";
    el.aiSettingsStatus.className = "status-pill";
    el.aiSettingsButton.textContent = "AI aktivieren";
  } else {
    el.aiSettingsStatus.textContent = "Noch nicht eingerichtet";
    el.aiSettingsStatus.className = "status-pill is-off";
    el.aiSettingsButton.textContent = "Einrichtung anzeigen";
  }
}

function exportData() {
  const payload = {
    type: "replant-backup",
    version: 4,
    exportedAt: new Date().toISOString(),
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    history: state.history,
    settings: { aiEnabled: state.aiEnabled, reduceMotion: state.reduceMotion },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `replant-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Sicherung wurde erstellt.");
}

async function importData() {
  const [file] = el.importDataInput.files || [];
  el.importDataInput.value = "";
  if (!file) return;
  if (file.size > 5_000_000) {
    showToast("Die Sicherungsdatei ist zu groß.", true);
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    if (data.type !== "replant-backup" || !Array.isArray(data.profiles)) throw new Error("Keine gültige RePlant-Sicherung.");
    const profiles = data.profiles.map(sanitizeProfile).filter(Boolean).slice(0, MAX_PROFILE_COUNT);
    if (!profiles.length) throw new Error("Die Sicherung enthält kein gültiges Profil.");
    state.profiles = profiles;
    state.activeProfileId = profiles.some((profile) => profile.id === data.activeProfileId) ? data.activeProfileId : profiles[0].id;
    state.history = Array.isArray(data.history) ? data.history.map(sanitizeHistoryEntry).filter(Boolean).slice(0, MAX_HISTORY) : [];
    state.reduceMotion = Boolean(data.settings?.reduceMotion);
    state.aiEnabled = state.aiAvailable && Boolean(data.settings?.aiEnabled);
    localStorage.setItem(STORAGE.profiles, JSON.stringify(state.profiles));
    localStorage.setItem(STORAGE.history, JSON.stringify(state.history));
    localStorage.setItem(STORAGE.activeProfile, state.activeProfileId);
    localStorage.setItem(STORAGE.reduceMotion, String(state.reduceMotion));
    localStorage.setItem(STORAGE.aiEnabled, String(state.aiEnabled));
    applyMotionPreference();
    renderProfilesEverywhere();
    renderProfileGrid();
    renderHistory();
    renderFavorites();
    renderAiState();
    showToast("Sicherung wurde wiederhergestellt.");
  } catch (error) {
    showToast(error.message || "Die Sicherung konnte nicht gelesen werden.", true);
  }
}

async function resetAllData() {
  const confirmed = await askConfirm("RePlant zurücksetzen?", "Alle Profile, Rezepte, Favoriten und lokalen Einstellungen werden gelöscht.");
  if (!confirmed) return;
  Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
  state.profiles = [{ ...DEFAULT_PROFILE }];
  state.activeProfileId = DEFAULT_PROFILE.id;
  state.history = [];
  state.currentResult = null;
  state.importedText = "";
  state.importedSourceUrl = "";
  state.aiEnabled = false;
  state.reduceMotion = false;
  el.recipeUrl.value = "";
  el.recipeText.value = "";
  el.sourceNotice.hidden = true;
  el.resultCard.hidden = true;
  applyMotionPreference();
  renderProfilesEverywhere();
  renderProfileGrid();
  renderHistory();
  renderFavorites();
  renderAiState();
  updateCharacterCount();
  switchView("start");
  showToast("RePlant wurde zurückgesetzt.");
}

function applyMotionPreference() {
  document.body.classList.toggle("reduce-motion", state.reduceMotion);
  el.motionToggle.setAttribute("aria-pressed", String(state.reduceMotion));
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  const labelNode = button.querySelector(":scope > span:first-child");
  if (labelNode) labelNode.textContent = label;
  else button.textContent = label;
  button.setAttribute("aria-busy", String(busy));
}

function setStatus(message, error = false) {
  el.conversionStatus.textContent = message;
  el.conversionStatus.classList.toggle("is-error", error);
}

async function requestJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { "content-type": "application/json", accept: "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || `Serverfehler (${response.status}).`);
    }
    return data || {};
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.");
    if (error instanceof TypeError) throw new Error("Die Website konnte den Server nicht erreichen. Läuft sie über Netlify?");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function showToast(message, error = false) {
  const toast = document.createElement("div");
  toast.className = `toast${error ? " is-error" : ""}`;
  const mark = document.createElement("span");
  mark.className = "toast-mark";
  mark.textContent = error ? "!" : "✓";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(mark, text);
  el.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), state.reduceMotion ? 1000 : 4200);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function askConfirm(title, text) {
  el.confirmDialogTitle.textContent = title;
  el.confirmDialogText.textContent = text;
  openDialog(el.confirmDialog);
  return new Promise((resolve) => {
    const handleClose = () => resolve(el.confirmDialog.returnValue === "confirm");
    el.confirmDialog.addEventListener("close", handleClose, { once: true });
  });
}
