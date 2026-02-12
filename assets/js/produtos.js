/* global gtag */
(async function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const storeParam = params.get("store") || "ml";

  if (!id) {
    document.title = "Produto não encontrado | AchouMais";
    const el = document.getElementById("productName");
    if (el) el.textContent = "Produto não encontrado";
    return;
  }

  const res = await fetch("../assets/data/produtos.json", { cache: "no-store" });
  const products = await res.json();

  const product = (Array.isArray(products) ? products : []).find(p => p.id === id);
  if (!product) {
    document.title = "Produto não encontrado | AchouMais";
    const el = document.getElementById("productName");
    if (el) el.textContent = "Produto não encontrado";
    return;
  }

  const storeKey = String(storeParam || "ml").toLowerCase();
  const stores = Array.isArray(product.stores) ? product.stores : [];

  const preferred =
    stores.find(s => String(s.store || "").toLowerCase() === storeKey) ||
    stores.find(s => String(s.store || "").toLowerCase() === "ml") ||
    stores[0];

  const affiliateUrl = preferred?.affiliateUrl;

  if (!affiliateUrl) {
    document.title = "Link indisponível | AchouMais";
    document.getElementById("productName").textContent = product.title;
    document.getElementById("productDesc").textContent = "Link indisponível no momento.";
    return;
  }

  // UI
  document.title = `${product.title} | AchouMais`;
  document.getElementById("productName").textContent = product.title;

  const img = document.getElementById("productImg");
  img.src = product.imageUrl;
  img.alt = product.title;

  document.getElementById("productDesc").textContent = product.description;

  const ctaEl = document.getElementById("cta");
  const storeLabel = preferred?.storeLabel || "na loja";
  ctaEl.href = affiliateUrl;
  ctaEl.textContent = `Abrir ${storeLabel} agora`;

  // Tracking helpers
  function safeGtagEvent(eventName, paramsObj) {
    try {
      if (typeof gtag === "function") gtag("event", eventName, paramsObj || {});
    } catch {}
  }

  // Evento de view do produto
  safeGtagEvent("product_view", {
    product_id: product.id,
    product_name: product.title,
    store: String(preferred?.store || storeKey || ""),
    page_type: "product_redirect"
  });

  // Page_view virtual por produto
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("id", product.id);
    url.searchParams.set("store", String(preferred?.store || storeKey || ""));

    safeGtagEvent("page_view", {
      page_title: document.title,
      page_location: url.toString(),
      page_path: `/p/produto/${product.id}`
    });
  } catch {}

  function trackOutbound(type) {
    safeGtagEvent(type, {
      event_category: "affiliate",
      product_id: product.id,
      product_name: product.title,
      store: String(preferred?.store || storeKey || ""),
      outbound_url: affiliateUrl,
      transport_type: "beacon"
    });
  }

  ctaEl.addEventListener("click", () => trackOutbound("manual_click"));

  // Redirect
  let seconds = 5;
  const countEl = document.getElementById("count");
  if (countEl) countEl.textContent = seconds;

  const timer = setInterval(() => {
    seconds--;
    if (countEl) countEl.textContent = seconds;

    if (seconds <= 0) {
      clearInterval(timer);
      trackOutbound("auto_redirect");

      setTimeout(() => {
        window.location.href = affiliateUrl;
      }, 180);
    }
  }, 1000);
})();
