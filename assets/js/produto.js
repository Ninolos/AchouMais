/* global gtag */
(async function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const storeParamRaw = (params.get("store") || "ml").toLowerCase().trim();

  function setNotFound() {
    document.title = "Produto não encontrado | AchouMais";
    const nameEl = document.getElementById("productName");
    if (nameEl) nameEl.textContent = "Produto não encontrado";
  }

  function safeText(elId, text) {
    const el = document.getElementById(elId);
    if (el) el.textContent = text || "";
  }

  function safeGtagEvent(eventName, paramsObj) {
    try {
      if (typeof gtag === "function") gtag("event", eventName, paramsObj || {});
    } catch {}
  }

  // 1) Normaliza store vindo da URL (aceita aliases)
  function normalizeStoreKey(v) {
    const s = String(v || "").toLowerCase().trim();

    const map = {
      ml: ["ml", "mercadolivre", "mercado-livre", "meli", "mercado"],
      shopee: ["shopee", "sh", "sp", "shoppe", "shoppee"],
      amazon: ["amazon", "amz", "az"]
    };

    for (const [canonical, aliases] of Object.entries(map)) {
      if (aliases.includes(s)) return canonical;
    }
    return s || "ml";
  }

  // 2) Normaliza URL (garante https:// e remove espaços)
  function normalizeUrl(url) {
    if (!url) return "";
    let u = String(url).trim();

    // se vier sem protocolo, força https
    if (u.startsWith("//")) u = "https:" + u;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;

    return u;
  }

  async function fetchProductsJson() {
    const candidates = [
      "../assets/data/produtos.json",
      "/assets/data/produtos.json",
      "./assets/data/produtos.json"
    ];

    let lastErr;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Falha ao carregar produtos.json");
  }

  if (!id) {
    setNotFound();
    return;
  }

  let products = [];
  try {
    products = await fetchProductsJson();
  } catch (e) {
    document.title = "Erro ao carregar | AchouMais";
    safeText("productName", "Erro ao carregar produtos");
    safeText("productDesc", "Não foi possível carregar a lista de produtos agora.");
    return;
  }

  const product = products.find(p => String(p.id) === String(id));
  if (!product) {
    setNotFound();
    return;
  }

  const storeKey = normalizeStoreKey(storeParamRaw);
  const stores = Array.isArray(product.stores) ? product.stores : [];

  // normaliza o store de cada item também (caso venha "sp", "sh", etc no JSON)
  function normalizedStoreFromItem(item) {
    return normalizeStoreKey(item?.store);
  }

  // 3) Escolha da loja: store da URL -> ml -> primeira
  const preferred =
    stores.find(s => normalizedStoreFromItem(s) === storeKey) ||
    stores.find(s => normalizedStoreFromItem(s) === "ml") ||
    stores[0];

  const affiliateUrl = normalizeUrl(preferred?.affiliateUrl);

  if (!affiliateUrl) {
    document.title = "Link indisponível | AchouMais";
    safeText("productName", product.title);
    safeText("productDesc", "Link indisponível no momento.");
    return;
  }

  // ========= UI =========
  document.title = `${product.title} | AchouMais`;
  safeText("productName", product.title);

  const img = document.getElementById("productImg");
  if (img) {
    img.src = product.imageUrl || "";
    img.alt = product.title || "Produto";
  }

  safeText("productDesc", product.description);

  const ctaEl = document.getElementById("cta");
  const storeNormalized = normalizedStoreFromItem(preferred) || storeKey;
  const storeLabel = preferred?.storeLabel || "na loja";

  const storeBtnClass =
    storeNormalized === "ml" ? "btnML" :
    storeNormalized === "shopee" ? "btnSP" :
    storeNormalized === "amazon" ? "btnAMZ" :
    "";

  if (ctaEl) {
    ctaEl.href = affiliateUrl;
    ctaEl.textContent = `Abrir ${storeLabel} agora`;
    if (storeBtnClass) ctaEl.classList.add(storeBtnClass);

    ctaEl.addEventListener("click", () => trackOutbound("manual_click"));
  }

  // ========= TRACKING (GA4) =========
  safeGtagEvent("product_view", {
    product_id: String(product.id),
    product_name: product.title,
    store: storeNormalized,
    page_type: "product_redirect"
  });

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("id", String(product.id));
    url.searchParams.set("store", storeNormalized);

    safeGtagEvent("page_view", {
      page_title: document.title,
      page_location: url.toString(),
      page_path: `/p/produto/${String(product.id)}`
    });
  } catch {}

  function trackOutbound(type) {
    safeGtagEvent(type, {
      event_category: "affiliate",
      product_id: String(product.id),
      product_name: product.title,
      store: storeNormalized,
      outbound_url: affiliateUrl,
      transport_type: "beacon"
    });
  }

  // ========= REDIRECT =========
  let seconds = 5;
  const countEl = document.getElementById("count");
  if (countEl) countEl.textContent = seconds;

  const timer = setInterval(() => {
    seconds--;
    if (countEl) countEl.textContent = seconds;

    if (seconds <= 0) {
      clearInterval(timer);

      trackOutbound("auto_redirect");

      // respiro para beacon
      setTimeout(() => {
        // ✅ mais confiável que window.location.href
        window.location.assign(affiliateUrl);
      }, 180);
    }
  }, 1000);
})();
