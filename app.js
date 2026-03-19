/* ===== RégulCA — Application Main Script ===== */
/* global VITAMINES, MINERAUX, PLANTES, ALLEGATIONS, MENTIONS_OBLIGATOIRES, REGLEMENTS,
   CATEGORIES, POPULATIONS, TYPES_INGREDIENTS, UNITES,
   VNR_MAP, DOSE_MAX_MAP, PLANTES_MAP,
   AUTHORIZED_VITAMINS, AUTHORIZED_MINERALS, AUTHORIZED_PLANTS */

(function () {
  "use strict";

  /* ===== API BASE ===== */
  var API_BASE = "";

  /* ===== AUTHENTIFICATION ===== */
  function getAuthToken() {
    return localStorage.getItem("regulca_token");
  }

  function authFetch(url, options) {
    /* Wrapper autour de fetch qui ajoute le token JWT et gère les 401. */
    options = options || {};
    options.headers = options.headers || {};
    var token = getAuthToken();
    if (token) {
      options.headers["Authorization"] = "Bearer " + token;
    }
    return fetch(url, options).then(function (response) {
      if (response.status === 401) {
        /* Token expiré ou invalide — rediriger vers login */
        localStorage.removeItem("regulca_token");
        window.location.href = "/login";
        return Promise.reject(new Error("Non authentifié"));
      }
      return response;
    });
  }

  function checkAuth() {
    /* Vérifier le token au démarrage. Redirige vers /login si invalide. */
    var token = getAuthToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    authFetch(API_BASE + "/api/auth/me").then(function (r) {
      if (!r.ok) throw new Error("auth_failed");
      return r.json();
    }).then(function (data) {
      /* Injecter le bouton de déconnexion dans la sidebar */
      injectLogoutButton(data.username);
    }).catch(function () {
      localStorage.removeItem("regulca_token");
      window.location.href = "/login";
    });
  }

  function injectLogoutButton(username) {
    /* Ajouter le bouton de déconnexion dans le footer de la sidebar. */
    var footer = document.querySelector(".sidebar-footer");
    if (!footer || document.getElementById("logout-btn")) return;
    var userInfo = document.createElement("div");
    userInfo.style.cssText = "padding:0.5rem 0.75rem;font-size:0.8125rem;color:var(--color-text-secondary);border-top:1px solid var(--color-border);margin-top:0.5rem;";
    userInfo.innerHTML = '<span style="opacity:0.7;">Connecté :</span> <strong>' + username + '</strong>';
    footer.insertBefore(userInfo, footer.firstChild);

    var btn = document.createElement("button");
    btn.id = "logout-btn";
    btn.className = "theme-toggle-btn";
    btn.style.cssText = "color:var(--color-danger, #dc2626);";
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Se déconnecter</span>';
    btn.addEventListener("click", function () {
      authFetch(API_BASE + "/api/auth/logout", { method: "POST" }).catch(function () {});
      localStorage.removeItem("regulca_token");
      window.location.href = "/login";
    });
    footer.appendChild(btn);
  }

  /* ===== STATE ===== */
  var state = {
    dossiers: [],
    currentDossier: null,
    wizardStep: 1,
    editingDossierId: null
  };

  /* ===== API DOSSIERS ===== */
  function loadDossiers(callback) {
    authFetch(API_BASE + "/api/dossiers").then(function (r) {
      return r.json();
    }).then(function (data) {
      state.dossiers = (data.dossiers || []).map(function (d) {
        /* Nettoyer les champs internes ajoutés par l'API */
        delete d._date_creation;
        delete d._date_modification;
        return d;
      });
      if (callback) callback();
    }).catch(function () {
      /* Serveur indisponible — on garde le tableau vide */
      state.dossiers = [];
      if (callback) callback();
    });
  }

  function saveDossierToAPI(dossier, isNew, callback) {
    var method = isNew ? "POST" : "PUT";
    var url = isNew ? API_BASE + "/api/dossiers" : API_BASE + "/api/dossiers/" + encodeURIComponent(dossier.id);
    authFetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dossier)
    }).then(function (r) {
      return r.json();
    }).then(function () {
      if (callback) callback(true);
    }).catch(function () {
      if (callback) callback(false);
    });
  }

  function deleteDossierFromAPI(dossierId, callback) {
    authFetch(API_BASE + "/api/dossiers/" + encodeURIComponent(dossierId), { method: "DELETE" })
      .then(function () { if (callback) callback(true); })
      .catch(function () { if (callback) callback(false); });
  }

  /* ===== HELPERS ===== */
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function getStatusBadge(statut) {
    var map = {
      "Brouillon": "badge-neutral",
      "En cours": "badge-primary",
      "Conforme": "badge-success",
      "À corriger": "badge-warning",
      "Soumis": "badge-accent"
    };
    return '<span class="badge ' + (map[statut] || "badge-neutral") + '">' + statut + "</span>";
  }

  function generateId() {
    /* Trouver le prochain numéro séquentiel parmi les dossiers existants */
    var maxNum = 0;
    state.dossiers.forEach(function (d) {
      var match = d.id && d.id.match(/DOS-\d{4}-(\d+)/);
      if (match) {
        var num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    var year = new Date().getFullYear();
    return "DOS-" + year + "-" + String(maxNum + 1).padStart(3, "0");
  }

  function checkIngredientCompliance(ingredient) {
    var nom = ingredient.nom;
    var quantite = parseFloat(ingredient.quantite) || 0;
    var type = ingredient.type;

    if (type === "Vitamine") {
      var isAuthorized = AUTHORIZED_VITAMINS.some(function (v) { return v === nom; });
      if (!isAuthorized) return { status: "error", message: "Vitamine non autorisée" };
      var maxInfo = DOSE_MAX_MAP[nom];
      if (maxInfo) {
        if (quantite > maxInfo.max) return { status: "error", message: "Dépasse la dose max (" + maxInfo.max + " " + maxInfo.unite + ")" };
        if (quantite > maxInfo.max * 0.8) return { status: "warning", message: "Proche de la dose max (" + maxInfo.max + " " + maxInfo.unite + ")" };
      }
      return { status: "success", message: "Conforme" };
    }

    if (type === "Minéral") {
      var isAuthMin = AUTHORIZED_MINERALS.some(function (m) { return m === nom; });
      if (!isAuthMin) return { status: "error", message: "Minéral non autorisé" };
      var maxInfoMin = DOSE_MAX_MAP[nom];
      if (maxInfoMin) {
        if (quantite > maxInfoMin.max) return { status: "error", message: "Dépasse la dose max (" + maxInfoMin.max + " " + maxInfoMin.unite + ")" };
        if (quantite > maxInfoMin.max * 0.8) return { status: "warning", message: "Proche de la dose max (" + maxInfoMin.max + " " + maxInfoMin.unite + ")" };
      }
      return { status: "success", message: "Conforme" };
    }

    if (type === "Plante") {
      var isAuthPlant = AUTHORIZED_PLANTS.some(function (p) { return p === nom; });
      if (!isAuthPlant) return { status: "warning", message: "Plante non trouvée dans la liste — vérifier l'arrêté du 24 juin 2014" };
      var plantInfo = PLANTES_MAP[nom];
      if (plantInfo && plantInfo.surveillance) return { status: "warning", message: plantInfo.surveillance };
      return { status: "success", message: "Conforme — liste positive" };
    }

    return { status: "success", message: "Excipient / Additif" };
  }

  function calculateVNR(nom, quantite) {
    var info = VNR_MAP[nom];
    if (!info || !info.vnr) return null;
    return Math.round((parseFloat(quantite) / info.vnr) * 100);
  }

  function detectProcedure(ingredients) {
    var hasNonListed = false;
    var hasNewIngredient = false;

    ingredients.forEach(function (ing) {
      var compliance = checkIngredientCompliance(ing);
      if (compliance.status === "error" && compliance.message.indexOf("non autorisé") > -1) {
        hasNewIngredient = true;
      }
      if (compliance.status === "warning" && compliance.message.indexOf("non trouvée") > -1) {
        hasNonListed = true;
      }
    });

    if (hasNewIngredient) return { procedure: "Art. 17-18", label: "Autorisation préalable", desc: "Dossier toxicologique complet requis. Évaluation par l'ANSES (12-24 mois)." };
    if (hasNonListed) return { procedure: "Art. 16", label: "Reconnaissance mutuelle", desc: "Ingrédient non listé en France. Preuve de commercialisation dans un État membre UE requise." };
    return { procedure: "Art. 15", label: "Déclaration simple", desc: "Produit conforme aux listes positives. Mise sur le marché dès la déclaration via Compl'Alim." };
  }

  function showToast(msg) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add("visible"); }, 10);
    setTimeout(function () {
      toast.classList.remove("visible");
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  /* ===== THEME TOGGLE ===== */
  function initTheme() {
    var root = document.documentElement;
    var isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = isDark ? "dark" : "light";
    root.setAttribute("data-theme", theme);

    function updateToggleIcons() {
      var current = root.getAttribute("data-theme");
      var btns = $$("[data-theme-toggle], [data-theme-toggle-mobile]");
      btns.forEach(function (btn) {
        var label = btn.querySelector("span");
        if (label) label.textContent = current === "dark" ? "Mode clair" : "Mode sombre";
        btn.querySelector("svg").innerHTML = current === "dark"
          ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
          : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      });
    }

    $$("[data-theme-toggle], [data-theme-toggle-mobile]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        theme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", theme);
        updateToggleIcons();
      });
    });

    updateToggleIcons();
  }

  /* ===== SIDEBAR ===== */
  function initSidebar() {
    var sidebar = $("#sidebar");
    var overlay = $("#sidebar-overlay");
    var hamburger = $("#hamburger-btn");
    var collapseBtn = $("#sidebar-toggle");

    hamburger.addEventListener("click", function () {
      sidebar.classList.add("open");
      overlay.classList.add("visible");
    });

    overlay.addEventListener("click", function () {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
    });

    collapseBtn.addEventListener("click", function () {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
    });

    /* Navigation médicament maintenant dans index.html — plus besoin d'injection JS */
  }

  /* ===== ROUTING ===== */
  function initRouter() {
    window.addEventListener("hashchange", route);
    route();
  }

  function route() {
    var hash = window.location.hash.slice(1) || "tableau-de-bord";
    var parts = hash.split("/");
    var page = parts[0];

    $$(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-nav") === page);
    });

    // Close mobile sidebar
    $("#sidebar").classList.remove("open");
    $("#sidebar-overlay").classList.remove("visible");

    var main = $("#main-content");
    main.scrollTop = 0;

    switch (page) {
      case "tableau-de-bord": renderDashboard(); break;
      case "nouveau-dossier": renderNouveauDossier(); break;
      case "mes-dossiers": renderMesDossiers(); break;
      case "verification-formule": renderVerificationFormule(); break;
      case "etiquetage": renderEtiquetage(); break;
      case "allegations": renderAllegations(); break;
      case "base-reglementaire": renderBaseReglementaire(); break;
      case "veille": renderVeille(); break;
      case "aide": renderAide(); break;
      case "voir-dossier":
        if (parts[1]) renderVoirDossier(parts[1]);
        else renderMesDossiers();
        break;
      /* --- Module Médicament (app_medicament.js) --- */
      case "dossier-ctd": renderDossierCTD(); break;
      case "mes-dossiers-ctd": renderMesDossiersCTD(); break;
      case "variations": renderVariations(); break;
      case "traduction": renderTraduction(); break;
      case "veille-medicament": renderVeilleMedicament(); break;
      case "voir-ctd":
        if (parts[1]) renderMesDossiersCTD();
        else renderMesDossiersCTD();
        break;
      default: renderDashboard();
    }
  }

  function navigateTo(hash) {
    window.location.hash = hash;
  }

  /* ===== RENDER: DASHBOARD ===== */
  function renderDashboard() {
    var enCours = state.dossiers.filter(function (d) { return d.statut === "En cours"; }).length;
    var conformes = state.dossiers.filter(function (d) { return d.statut === "Conforme"; }).length;
    var aCorriger = state.dossiers.filter(function (d) { return d.statut === "À corriger"; }).length;
    var soumis = state.dossiers.filter(function (d) { return d.statut === "Soumis"; }).length;

    var html = '<div class="page-header">' +
      '<h1 class="page-title">Tableau de bord</h1>' +
      '<p class="page-subtitle">Vue d\'ensemble de vos dossiers réglementaires</p>' +
      "</div>" +
      '<div class="kpi-grid">' +
      kpiCard("Dossiers en cours", enCours, "badge-primary", "En cours") +
      kpiCard("Conformes", conformes, "badge-success", "Validés") +
      kpiCard("À corriger", aCorriger, "badge-warning", "Action requise") +
      kpiCard("Soumis", soumis, "badge-accent", "Envoyés") +
      "</div>" +
      '<div class="card">' +
      '<div class="card-title">Actions rapides</div>' +
      '<div class="quick-actions">' +
      '<a href="#nouveau-dossier" class="quick-action-card">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>' +
        '<span>Nouveau dossier</span>' +
      "</a>" +
      '<a href="#verification-formule" class="quick-action-card">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
        '<span>Vérifier une formule</span>' +
      "</a>" +
      '<a href="#base-reglementaire" class="quick-action-card">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
        '<span>Base réglementaire</span>' +
      "</a>" +
      "</div></div>" +
      '<div class="card">' +
      '<div class="card-title">Derniers dossiers</div>';

    if (state.dossiers.length === 0) {
      html += '<div class="empty-state"><p>Aucun dossier créé pour l\'instant.</p>' +
        '<a href="#nouveau-dossier" class="btn btn-primary">Créer un dossier</a></div>';
    } else {
      html += '<table class="data-table"><thead><tr>' +
        "<th>Référence</th><th>Nom commercial</th><th>Catégorie</th><th>Statut</th><th>Modifié le</th><th></th>" +
        "</tr></thead><tbody>";
      var recent = state.dossiers.slice().sort(function (a, b) { return b.dateModification.localeCompare(a.dateModification); });
      recent.forEach(function (d) {
        html += "<tr>" +
          "<td><strong>" + d.id + "</strong></td>" +
          "<td>" + d.nom + "</td>" +
          "<td>" + d.categorie + "</td>" +
          "<td>" + getStatusBadge(d.statut) + "</td>" +
          "<td>" + formatDate(d.dateModification) + "</td>" +
          '<td><a href="#voir-dossier/' + d.id + '" class="btn btn-ghost btn-sm">Voir</a></td>' +
          "</tr>";
      });
      html += "</tbody></table>";
    }
    html += "</div>";

    // Alertes réglementaires récentes section
    html += '<div class="card">' +
      '<div class="card-title">Alertes réglementaires récentes</div>' +
      '<div id="dashboard-alertes"><span style="font-size:var(--text-xs);color:var(--color-text-faint);">Chargement…</span></div>' +
      '</div>';

    $("#main-content").innerHTML = html;
    renderDashboardAlertes();
  }

  function kpiCard(label, value, badgeClass, badgeText) {
    return '<div class="kpi-card">' +
      '<div class="kpi-label">' + label + "</div>" +
      '<div class="kpi-value">' + value + "</div>" +
      '<div class="kpi-badge ' + badgeClass + '">' + badgeText + "</div>" +
      "</div>";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    var parts = dateStr.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  /* ===== RENDER: NOUVEAU DOSSIER (WIZARD) ===== */
  function renderNouveauDossier() {
    if (!state.currentDossier) {
      state.currentDossier = {
        id: generateId(),
        nom: "",
        categorie: "",
        forme: "",
        populations: [],
        exploitant: { nom: "", adresse: "", siret: "" },
        fabricant: { nom: "", adresse: "", pays: "France" },
        ingredients: [{ nom: "", type: "Vitamine", forme: "", quantite: "", unite: "mg", vnr: null }],
        allergenes: "",
        mentionsChecked: [],
        allegations: [],
        statut: "Brouillon",
        dateCreation: new Date().toISOString().slice(0, 10),
        dateModification: new Date().toISOString().slice(0, 10)
      };
      state.wizardStep = 1;
    }
    renderWizard();
  }

  function renderWizard() {
    var steps = [
      { num: 1, label: "Informations générales" },
      { num: 2, label: "Formulation" },
      { num: 3, label: "Étiquetage" },
      { num: 4, label: "Allégations" },
      { num: 5, label: "Récapitulatif" }
    ];

    var html = '<div class="page-header">' +
      '<h1 class="page-title">' + (state.editingDossierId ? "Modifier le dossier" : "Nouveau dossier") + "</h1>" +
      '<p class="page-subtitle">Dossier ' + state.currentDossier.id + "</p></div>";

    html += '<div class="wizard-stepper">';
    steps.forEach(function (s, i) {
      var cls = s.num === state.wizardStep ? "active" : (s.num < state.wizardStep ? "completed" : "");
      html += '<div class="wizard-step ' + cls + '">' +
        '<div class="wizard-step-number">' + (s.num < state.wizardStep ? "✓" : s.num) + "</div>" +
        '<div class="wizard-step-label">' + s.label + "</div>" +
        "</div>";
      if (i < steps.length - 1) {
        html += '<div class="wizard-connector ' + (s.num < state.wizardStep ? "completed" : "") + '"></div>';
      }
    });
    html += "</div>";

    html += '<div class="card">';
    switch (state.wizardStep) {
      case 1: html += renderStep1(); break;
      case 2: html += renderStep2(); break;
      case 3: html += renderStep3(); break;
      case 4: html += renderStep4(); break;
      case 5: html += renderStep5(); break;
    }
    html += "</div>";

    html += '<div class="wizard-actions">';
    if (state.wizardStep > 1) {
      html += '<button class="btn btn-secondary" onclick="window._wizardPrev()">← Étape précédente</button>';
    } else {
      html += "<div></div>";
    }
    if (state.wizardStep < 5) {
      html += '<button class="btn btn-primary" onclick="window._wizardNext()">Étape suivante →</button>';
    } else {
      html += '<button class="btn btn-success btn-lg" onclick="window._saveDossier()">💾 Enregistrer le dossier</button>';
    }
    html += "</div>";

    $("#main-content").innerHTML = html;
    bindWizardEvents();
  }

  window._wizardPrev = function () {
    saveCurrentStepData();
    state.wizardStep--;
    renderWizard();
  };

  window._wizardNext = function () {
    saveCurrentStepData();
    state.wizardStep++;
    renderWizard();
  };

  window._saveDossier = function () {
    saveCurrentStepData();
    var d = state.currentDossier;
    d.dateModification = new Date().toISOString().slice(0, 10);

    // Déterminer le statut global
    var allCompliant = d.ingredients.every(function (ing) {
      if (!ing.nom) return true;
      return checkIngredientCompliance(ing).status === "success";
    });
    d.statut = allCompliant && d.ingredients.length > 0 ? "Conforme" : "À corriger";

    var isNew = !state.editingDossierId;
    saveDossierToAPI(d, isNew, function (success) {
      if (success) {
        if (state.editingDossierId) {
          var idx = state.dossiers.findIndex(function (dd) { return dd.id === state.editingDossierId; });
          if (idx > -1) state.dossiers[idx] = d;
        } else {
          state.dossiers.push(d);
        }
        state.currentDossier = null;
        state.editingDossierId = null;
        state.wizardStep = 1;
        showToast("Dossier enregistré avec succès !");
        navigateTo("mes-dossiers");
      } else {
        showToast("Erreur lors de l'enregistrement du dossier.");
      }
    });
  };

  /* ===== STEP 1: GENERAL INFO ===== */
  function renderStep1() {
    var d = state.currentDossier;
    var html = '<h3 class="card-title">Étape 1 — Informations générales</h3>';
    html += '<div class="form-grid">';
    html += formField("nom", "Nom commercial", "text", d.nom, "Ex: MagVital B6 Fort");
    html += formSelect("categorie", "Catégorie", CATEGORIES, d.categorie);
    html += formField("forme", "Forme galénique", "text", d.forme, "Ex: Gélule végétale HPMC");
    html += "</div>";

    html += '<div class="form-group"><label class="form-label">Population cible</label>' +
      '<div class="multi-select-group">';
    POPULATIONS.forEach(function (p) {
      var sel = d.populations.indexOf(p) > -1 ? " selected" : "";
      html += '<div class="multi-select-chip' + sel + '" data-pop="' + p + '">' + p + "</div>";
    });
    html += "</div></div>";

    html += '<h4 style="font-family:var(--font-display);font-weight:600;font-size:var(--text-base);margin:var(--space-6) 0 var(--space-4);">Exploitant responsable</h4>';
    html += '<div class="form-grid">';
    html += formField("exp-nom", "Nom", "text", d.exploitant.nom, "Raison sociale");
    html += formField("exp-adresse", "Adresse", "text", d.exploitant.adresse, "Adresse complète");
    html += formField("exp-siret", "SIRET", "text", d.exploitant.siret, "XXX XXX XXX XXXXX");
    html += "</div>";

    html += '<h4 style="font-family:var(--font-display);font-weight:600;font-size:var(--text-base);margin:var(--space-6) 0 var(--space-4);">Fabricant</h4>';
    html += '<div class="form-grid">';
    html += formField("fab-nom", "Nom", "text", d.fabricant.nom, "Raison sociale");
    html += formField("fab-adresse", "Adresse", "text", d.fabricant.adresse, "Adresse complète");
    html += formField("fab-pays", "Pays", "text", d.fabricant.pays, "Ex: France");
    html += "</div>";

    return html;
  }

  /* ===== STEP 2: FORMULATION ===== */
  function renderStep2() {
    var d = state.currentDossier;
    var proc = detectProcedure(d.ingredients);

    var html = '<h3 class="card-title">Étape 2 — Formulation / Composition</h3>';
    html += '<div class="procedure-indicator">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
      "Procédure détectée : " + proc.procedure + " — " + proc.label +
      "</div>";

    html += '<div class="ingredient-header ingredient-row">' +
      "<div>Ingrédient</div><div>Type</div><div>Forme chimique</div><div>Quantité/dose</div><div>Unité</div><div>%VNR</div><div>Statut</div><div></div>" +
      "</div>";

    d.ingredients.forEach(function (ing, i) {
      var compliance = ing.nom ? checkIngredientCompliance(ing) : { status: "", message: "" };
      var vnrVal = (ing.type === "Vitamine" || ing.type === "Minéral") ? calculateVNR(ing.nom, ing.quantite) : null;

      html += '<div class="ingredient-row" data-idx="' + i + '">';
      html += '<input class="form-input ing-nom" value="' + esc(ing.nom) + '" placeholder="Nom ingrédient" list="ing-list-' + i + '">';
      html += buildIngredientDatalist(i, ing.type);
      html += '<select class="form-select ing-type">' + optionsHtml(TYPES_INGREDIENTS, ing.type) + "</select>";
      html += '<input class="form-input ing-forme" value="' + esc(ing.forme) + '" placeholder="Forme">';
      html += '<input class="form-input ing-quantite" type="number" step="any" value="' + (ing.quantite || "") + '" placeholder="0">';
      html += '<select class="form-select ing-unite">' + optionsHtml(UNITES, ing.unite) + "</select>";
      html += '<div style="font-size:var(--text-xs);font-weight:600;text-align:center;">' + (vnrVal !== null ? vnrVal + "%" : "—") + "</div>";
      html += '<div>' + (compliance.status ? '<span class="badge badge-' + compliance.status + '">' + (compliance.status === "success" ? "✓" : compliance.status === "warning" ? "⚠" : "✗") + "</span>" : "") + "</div>";
      html += '<button class="remove-ingredient-btn" onclick="window._removeIngredient(' + i + ')" title="Supprimer">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
      html += "</div>";

      if (compliance.message && ing.nom) {
        html += '<div style="font-size:11px;color:var(--color-' + (compliance.status === "success" ? "success" : compliance.status === "warning" ? "warning" : "error") + ');margin:-4px 0 8px 4px;padding-left:4px;">' + compliance.message + "</div>";
      }
    });

    html += '<button class="btn btn-secondary" style="margin-top:var(--space-4);" onclick="window._addIngredient()">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter un ingrédient</button>';

    return html;
  }

  function buildIngredientDatalist(i, type) {
    var items = [];
    if (type === "Vitamine") items = AUTHORIZED_VITAMINS;
    else if (type === "Minéral") items = AUTHORIZED_MINERALS;
    else if (type === "Plante") items = AUTHORIZED_PLANTS;
    var html = '<datalist id="ing-list-' + i + '">';
    items.forEach(function (item) { html += '<option value="' + esc(item) + '">'; });
    html += "</datalist>";
    return html;
  }

  window._addIngredient = function () {
    saveCurrentStepData();
    state.currentDossier.ingredients.push({ nom: "", type: "Vitamine", forme: "", quantite: "", unite: "mg", vnr: null });
    renderWizard();
  };

  window._removeIngredient = function (idx) {
    saveCurrentStepData();
    state.currentDossier.ingredients.splice(idx, 1);
    if (state.currentDossier.ingredients.length === 0) {
      state.currentDossier.ingredients.push({ nom: "", type: "Vitamine", forme: "", quantite: "", unite: "mg", vnr: null });
    }
    renderWizard();
  };

  /* ===== STEP 3: ETIQUETAGE ===== */
  function renderStep3() {
    var d = state.currentDossier;
    var html = '<h3 class="card-title">Étape 3 — Étiquetage</h3>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6);">';

    // Left: Checklist
    html += "<div>";
    html += '<h4 style="font-family:var(--font-display);font-weight:600;margin-bottom:var(--space-4);">Mentions obligatoires</h4>';
    MENTIONS_OBLIGATOIRES.forEach(function (m) {
      var checked = d.mentionsChecked.indexOf(m.id) > -1 ? " checked" : "";
      html += '<label class="checkbox-group" style="margin-bottom:var(--space-2);">' +
        '<input type="checkbox" class="mention-cb" data-id="' + m.id + '"' + checked + ">" +
        '<span style="font-size:var(--text-xs);">' + m.texte + ' <span style="color:var(--color-text-faint);">(' + m.ref + ")</span></span>" +
        "</label>";
    });
    html += '<div class="form-group" style="margin-top:var(--space-4);">' +
      '<label class="form-label">Allergènes</label>' +
      '<input class="form-input" id="allergenes-input" value="' + esc(d.allergenes) + '" placeholder="Ex: Gluten, Soja, Lait...">' +
      '<div class="form-hint">Les allergènes apparaîtront en gras sur l\'étiquette</div>' +
      "</div>";
    html += "</div>";

    // Right: Preview
    html += "<div>";
    html += '<h4 style="font-family:var(--font-display);font-weight:600;margin-bottom:var(--space-4);">Prévisualisation étiquette</h4>';
    html += renderLabelPreview(d);
    html += "</div></div>";

    return html;
  }

  function renderLabelPreview(d) {
    var html = '<div class="label-preview">';
    html += "<div class=\"label-section\"><h4>COMPLÉMENT ALIMENTAIRE</h4>";
    html += "<div>" + (d.nom || "Nom du produit") + "</div>";
    html += "<div style='font-size:12px;color:#666;'>" + (d.forme || "Forme galénique") + " — " + (d.categorie || "Catégorie") + "</div></div>";

    // Ingredients list
    var ingNames = d.ingredients.filter(function (i) { return i.nom; }).map(function (i) { return i.nom; });
    html += '<div class="label-section"><div class="label-title">Ingrédients</div>';
    html += "<div>" + (ingNames.length ? ingNames.join(", ") : "<em>Aucun ingrédient</em>");
    if (d.allergenes) html += ". Allergènes : <strong>" + d.allergenes + "</strong>";
    html += "</div></div>";

    // Nutritional table
    var vitMins = d.ingredients.filter(function (i) { return i.type === "Vitamine" || i.type === "Minéral"; });
    if (vitMins.length) {
      html += '<div class="label-section"><div class="label-title">Informations nutritionnelles</div>';
      html += '<table class="nutritional-table"><thead><tr><th>Nutriment</th><th>Par dose</th><th>%VNR</th></tr></thead><tbody>';
      vitMins.forEach(function (ing) {
        var vnr = calculateVNR(ing.nom, ing.quantite);
        html += "<tr><td>" + ing.nom + "</td><td>" + (ing.quantite || "—") + " " + ing.unite + "</td><td>" + (vnr !== null ? vnr + "%" : "—") + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }

    // Mandatory mentions
    html += '<div class="label-section"><div class="label-title">Mentions réglementaires</div>';
    html += '<div style="font-size:11px;line-height:1.6;">';
    html += "Ne pas dépasser la dose journalière recommandée.<br>";
    html += "Les compléments alimentaires ne doivent pas être utilisés comme substituts d'un régime alimentaire varié et équilibré.<br>";
    html += "Tenir hors de portée des jeunes enfants.";
    html += "</div></div>";

    html += '<div class="label-section"><div class="label-title">Exploitant</div>';
    html += '<div style="font-size:11px;">' + (d.exploitant.nom || "—") + "<br>" + (d.exploitant.adresse || "") + "</div></div>";

    html += "</div>";
    return html;
  }

  /* ===== STEP 4: ALLEGATIONS ===== */
  function renderStep4() {
    var d = state.currentDossier;
    var html = '<h3 class="card-title">Étape 4 — Allégations santé</h3>';

    // Get substances that have claims
    var availableSubstances = Object.keys(ALLEGATIONS);
    var dossieredSubstances = d.ingredients.filter(function (ing) {
      return availableSubstances.indexOf(ing.nom) > -1;
    });

    if (dossieredSubstances.length === 0) {
      html += '<div class="empty-state" style="padding:var(--space-8);">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
        "<p>Aucun ingrédient de la formulation ne dispose d'allégations santé autorisées.<br>Ajoutez des vitamines ou minéraux à l'étape 2 pour accéder aux allégations.</p></div>";
      return html;
    }

    dossieredSubstances.forEach(function (ing) {
      var claims = ALLEGATIONS[ing.nom];
      if (!claims) return;
      var dose = parseFloat(ing.quantite) || 0;

      html += '<div style="margin-bottom:var(--space-6);">';
      html += '<h4 style="font-family:var(--font-display);font-weight:600;margin-bottom:var(--space-3);">' + ing.nom + ' <span style="font-weight:400;font-size:var(--text-xs);color:var(--color-text-muted);">(' + dose + " " + ing.unite + " par dose)</span></h4>";

      claims.forEach(function (claim) {
        var meetsDose = dose >= claim.doseMin;
        var isSelected = d.allegations.some(function (a) { return a.substance === ing.nom && a.texte === claim.texte; });

        html += '<label class="checkbox-group" style="margin-bottom:var(--space-3);padding:var(--space-3);border:1px solid var(--color-divider);border-radius:var(--radius-md);background:var(--color-surface);">' +
          '<input type="checkbox" class="allegation-cb" data-substance="' + esc(ing.nom) + '" data-claim="' + esc(claim.texte) + '"' + (isSelected ? " checked" : "") + (meetsDose ? "" : " disabled") + ">" +
          "<div>" +
          '<div style="font-size:var(--text-sm);">« ' + claim.texte + ' »</div>' +
          '<div style="font-size:11px;margin-top:4px;">' +
          (meetsDose
            ? '<span style="color:var(--color-success);">✓ Dose suffisante (min ' + claim.doseMin + " " + claim.unite + " = " + claim.pctVNR + "% VNR)</span>"
            : '<span style="color:var(--color-error);">✗ Dose insuffisante — minimum ' + claim.doseMin + " " + claim.unite + " requis (" + claim.pctVNR + "% VNR)</span>") +
          "</div></div></label>";
      });
      html += "</div>";
    });

    return html;
  }

  /* ===== STEP 5: RECAP ===== */
  function renderStep5() {
    var d = state.currentDossier;
    var proc = detectProcedure(d.ingredients);

    var totalChecks = 0;
    var passedChecks = 0;

    // Count compliance
    var ingredientResults = d.ingredients.filter(function (i) { return i.nom; }).map(function (ing) {
      totalChecks++;
      var c = checkIngredientCompliance(ing);
      if (c.status === "success") passedChecks++;
      return { nom: ing.nom, compliance: c };
    });

    var mentionCount = d.mentionsChecked.length;
    totalChecks += 15;
    passedChecks += mentionCount;

    // Has exploitant info
    totalChecks++;
    if (d.exploitant.nom && d.exploitant.adresse) passedChecks++;

    var score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    var html = '<h3 class="card-title">Étape 5 — Récapitulatif</h3>';

    // Score
    html += '<div style="display:grid;grid-template-columns:200px 1fr;gap:var(--space-8);margin-bottom:var(--space-6);">';
    html += '<div class="compliance-score">';
    html += renderScoreCircle(score);
    html += '<div style="font-family:var(--font-display);font-weight:600;font-size:var(--text-sm);">Score de conformité</div>';
    html += "</div>";

    html += "<div>";
    html += '<div class="procedure-indicator" style="margin-bottom:var(--space-4);">' + proc.procedure + " — " + proc.label + "</div>";
    html += '<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-4);">' + proc.desc + "</p>";

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);font-size:var(--text-sm);">';
    html += "<div><strong>Nom :</strong> " + (d.nom || "—") + "</div>";
    html += "<div><strong>Catégorie :</strong> " + (d.categorie || "—") + "</div>";
    html += "<div><strong>Forme :</strong> " + (d.forme || "—") + "</div>";
    html += "<div><strong>Populations :</strong> " + (d.populations.join(", ") || "—") + "</div>";
    html += "<div><strong>Exploitant :</strong> " + (d.exploitant.nom || "—") + "</div>";
    html += "<div><strong>Fabricant :</strong> " + (d.fabricant.nom || "—") + "</div>";
    html += "</div></div></div>";

    // Checklist
    html += '<h4 style="font-family:var(--font-display);font-weight:600;margin-bottom:var(--space-3);">Vérification des ingrédients</h4>';
    ingredientResults.forEach(function (r) {
      var icon = r.compliance.status === "success" ? "pass" : (r.compliance.status === "warning" ? "warn" : "fail");
      var sym = icon === "pass" ? "✓" : (icon === "warn" ? "⚠" : "✗");
      html += '<div class="checklist-item">' +
        '<div class="checklist-icon ' + icon + '">' + sym + "</div>" +
        "<div><strong>" + r.nom + "</strong> — " + r.compliance.message + "</div></div>";
    });

    html += '<h4 style="font-family:var(--font-display);font-weight:600;margin:var(--space-6) 0 var(--space-3);">Mentions obligatoires (' + mentionCount + "/15)</h4>";
    MENTIONS_OBLIGATOIRES.forEach(function (m) {
      var checked = d.mentionsChecked.indexOf(m.id) > -1;
      html += '<div class="checklist-item">' +
        '<div class="checklist-icon ' + (checked ? "pass" : "fail") + '">' + (checked ? "✓" : "✗") + "</div>" +
        '<div style="font-size:var(--text-xs);">' + m.texte + "</div></div>";
    });

    if (d.allegations.length > 0) {
      html += '<h4 style="font-family:var(--font-display);font-weight:600;margin:var(--space-6) 0 var(--space-3);">Allégations sélectionnées</h4>';
      d.allegations.forEach(function (a) {
        html += '<div class="checklist-item"><div class="checklist-icon pass">✓</div>' +
          "<div><strong>" + a.substance + "</strong> — « " + a.texte + " »</div></div>";
      });
    }

    return html;
  }

  function renderScoreCircle(score) {
    var color = score >= 80 ? "var(--color-success)" : (score >= 50 ? "var(--color-warning)" : "var(--color-error)");
    var circumference = 2 * Math.PI * 50;
    var offset = circumference - (score / 100) * circumference;

    return '<div class="score-circle">' +
      '<svg width="120" height="120" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="50" stroke="var(--color-divider)" stroke-width="10" fill="none"/>' +
      '<circle cx="60" cy="60" r="50" stroke="' + color + '" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/>' +
      "</svg>" +
      '<div class="score-value" style="color:' + color + ';">' + score + "%</div></div>";
  }

  /* ===== SAVE STEP DATA ===== */
  function saveCurrentStepData() {
    var d = state.currentDossier;
    if (!d) return;

    if (state.wizardStep === 1) {
      var nomEl = document.getElementById("field-nom");
      if (nomEl) d.nom = nomEl.value;
      var catEl = document.getElementById("field-categorie");
      if (catEl) d.categorie = catEl.value;
      var formeEl = document.getElementById("field-forme");
      if (formeEl) d.forme = formeEl.value;
      var expNom = document.getElementById("field-exp-nom");
      if (expNom) d.exploitant.nom = expNom.value;
      var expAddr = document.getElementById("field-exp-adresse");
      if (expAddr) d.exploitant.adresse = expAddr.value;
      var expSiret = document.getElementById("field-exp-siret");
      if (expSiret) d.exploitant.siret = expSiret.value;
      var fabNom = document.getElementById("field-fab-nom");
      if (fabNom) d.fabricant.nom = fabNom.value;
      var fabAddr = document.getElementById("field-fab-adresse");
      if (fabAddr) d.fabricant.adresse = fabAddr.value;
      var fabPays = document.getElementById("field-fab-pays");
      if (fabPays) d.fabricant.pays = fabPays.value;

      d.populations = [];
      $$(".multi-select-chip.selected").forEach(function (chip) {
        d.populations.push(chip.getAttribute("data-pop"));
      });
    }

    if (state.wizardStep === 2) {
      var rows = $$(".ingredient-row[data-idx]");
      d.ingredients = [];
      rows.forEach(function (row) {
        d.ingredients.push({
          nom: row.querySelector(".ing-nom").value.trim(),
          type: row.querySelector(".ing-type").value,
          forme: row.querySelector(".ing-forme").value.trim(),
          quantite: row.querySelector(".ing-quantite").value,
          unite: row.querySelector(".ing-unite").value,
          vnr: null
        });
      });
    }

    if (state.wizardStep === 3) {
      d.mentionsChecked = [];
      $$(".mention-cb:checked").forEach(function (cb) {
        d.mentionsChecked.push(parseInt(cb.getAttribute("data-id")));
      });
      var allergEl = document.getElementById("allergenes-input");
      if (allergEl) d.allergenes = allergEl.value;
    }

    if (state.wizardStep === 4) {
      d.allegations = [];
      $$(".allegation-cb:checked").forEach(function (cb) {
        d.allegations.push({
          substance: cb.getAttribute("data-substance"),
          texte: cb.getAttribute("data-claim")
        });
      });
    }
  }

  function bindWizardEvents() {
    // Population multi-select
    $$(".multi-select-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("selected");
      });
    });
  }

  /* ===== RENDER: MES DOSSIERS ===== */
  function renderMesDossiers() {
    var html = '<div class="page-header">' +
      '<h1 class="page-title">Mes dossiers</h1>' +
      '<p class="page-subtitle">' + state.dossiers.length + " dossier(s) enregistré(s)</p></div>";

    if (state.dossiers.length === 0) {
      html += '<div class="empty-state">' +
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
        "<p>Aucun dossier créé pour l'instant.</p>" +
        '<a href="#nouveau-dossier" class="btn btn-primary">Créer un dossier</a></div>';
    } else {
      html += '<div class="card" style="padding:0;overflow:hidden;">' +
        '<table class="data-table"><thead><tr>' +
        "<th>Réf.</th><th>Nom commercial</th><th>Catégorie</th><th>Ingrédients</th><th>Procédure</th><th>Statut</th><th>Modifié</th><th></th>" +
        "</tr></thead><tbody>";
      state.dossiers.forEach(function (d) {
        var proc = detectProcedure(d.ingredients);
        html += "<tr>" +
          "<td><strong>" + d.id + "</strong></td>" +
          "<td>" + d.nom + "</td>" +
          "<td>" + d.categorie + "</td>" +
          "<td>" + d.ingredients.filter(function (i) { return i.nom; }).length + "</td>" +
          "<td><span class='badge badge-primary'>" + proc.procedure + "</span></td>" +
          "<td>" + getStatusBadge(d.statut) + "</td>" +
          "<td>" + formatDate(d.dateModification) + "</td>" +
          "<td style='display:flex;gap:var(--space-2);'>" +
          '<a href="#voir-dossier/' + d.id + '" class="btn btn-ghost btn-sm">Voir</a>' +
          '<button class="btn btn-secondary btn-sm" onclick="window._editDossier(\'' + d.id + '\')">Modifier</button>' +
          '<button class="btn btn-error btn-sm" onclick="window._deleteDossier(\'' + d.id + '\')">Supprimer</button>' +
          "</td></tr>";
      });
      html += "</tbody></table></div>";
    }

    $("#main-content").innerHTML = html;
  }

  window._editDossier = function (id) {
    var d = state.dossiers.find(function (dd) { return dd.id === id; });
    if (d) {
      state.currentDossier = JSON.parse(JSON.stringify(d));
      state.editingDossierId = id;
      state.wizardStep = 1;
      navigateTo("nouveau-dossier");
    }
  };

  window._deleteDossier = function (id) {
    if (!confirm("Supprimer le dossier " + id + " ?")) return;
    deleteDossierFromAPI(id, function (success) {
      if (success) {
        state.dossiers = state.dossiers.filter(function (dd) { return dd.id !== id; });
        showToast("Dossier " + id + " supprimé.");
        renderMesDossiers();
      } else {
        showToast("Erreur lors de la suppression.");
      }
    });
  };

  /* ===== RENDER: VOIR DOSSIER ===== */
  function renderVoirDossier(id) {
    var d = state.dossiers.find(function (dd) { return dd.id === id; });
    if (!d) { renderMesDossiers(); return; }

    var proc = detectProcedure(d.ingredients);
    var html = '<div class="page-header">' +
      '<div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-2);">' +
      '<a href="#mes-dossiers" class="btn btn-ghost btn-sm">← Retour</a>' +
      getStatusBadge(d.statut) +
      "</div>" +
      '<h1 class="page-title">' + d.nom + "</h1>" +
      '<p class="page-subtitle">' + d.id + " · " + d.categorie + " · " + d.forme + "</p></div>";

    html += '<div class="procedure-indicator">' + proc.procedure + " — " + proc.label + "</div>";

    html += '<div class="card"><div class="card-title">Informations générales</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);font-size:var(--text-sm);">';
    html += "<div><strong>Populations :</strong> " + d.populations.join(", ") + "</div>";
    html += "<div><strong>Exploitant :</strong> " + d.exploitant.nom + "</div>";
    html += "<div><strong>Fabricant :</strong> " + d.fabricant.nom + " (" + d.fabricant.pays + ")</div>";
    html += "<div><strong>Créé le :</strong> " + formatDate(d.dateCreation) + "</div>";
    html += "</div></div>";

    html += '<div class="card"><div class="card-title">Formulation</div>';
    html += '<table class="data-table"><thead><tr><th>Ingrédient</th><th>Type</th><th>Forme</th><th>Dose/jour</th><th>%VNR</th><th>Conformité</th></tr></thead><tbody>';
    d.ingredients.forEach(function (ing) {
      if (!ing.nom) return;
      var c = checkIngredientCompliance(ing);
      var vnr = calculateVNR(ing.nom, ing.quantite);
      html += "<tr><td><strong>" + ing.nom + "</strong></td><td>" + ing.type + "</td><td>" + ing.forme + "</td>" +
        "<td>" + ing.quantite + " " + ing.unite + "</td>" +
        "<td>" + (vnr !== null ? vnr + "%" : "—") + "</td>" +
        '<td><span class="badge badge-' + c.status + '">' + c.message + "</span></td></tr>";
    });
    html += "</tbody></table></div>";

    if (d.allegations.length) {
      html += '<div class="card"><div class="card-title">Allégations santé</div>';
      d.allegations.forEach(function (a) {
        html += '<div style="padding:var(--space-2) 0;font-size:var(--text-sm);"><strong>' + a.substance + "</strong> — « " + a.texte + " »</div>";
      });
      html += "</div>";
    }

    html += '<div style="margin-top:var(--space-4);">' +
      '<button class="btn btn-primary" onclick="window._editDossier(\'' + d.id + '\')">Modifier ce dossier</button></div>';

    $("#main-content").innerHTML = html;
  }

  /* ===== RENDER: VERIFICATION FORMULE ===== */
  function renderVerificationFormule() {
    var html = '<div class="page-header">' +
      '<h1 class="page-title">Vérification de formule</h1>' +
      '<p class="page-subtitle">Vérifiez rapidement la conformité d\'un ingrédient</p></div>';

    html += '<div class="card"><div class="card-title">Saisie rapide</div>';
    html += '<div class="form-grid">';
    html += '<div class="form-group"><label class="form-label">Type d\'ingrédient</label>' +
      '<select class="form-select" id="verif-type">' + optionsHtml(TYPES_INGREDIENTS, "Vitamine") + "</select></div>";
    html += '<div class="form-group"><label class="form-label">Nom de l\'ingrédient</label>' +
      '<input class="form-input" id="verif-nom" placeholder="Ex: Vitamine C" list="verif-datalist">' +
      '<datalist id="verif-datalist"></datalist></div>';
    html += '<div class="form-group"><label class="form-label">Quantité par dose journalière</label>' +
      '<input class="form-input" id="verif-quantite" type="number" step="any" placeholder="0"></div>';
    html += '<div class="form-group"><label class="form-label">Unité</label>' +
      '<select class="form-select" id="verif-unite">' + optionsHtml(UNITES, "mg") + "</select></div>";
    html += "</div>";
    html += '<button class="btn btn-accent" id="verif-btn" style="margin-top:var(--space-4);">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Vérifier</button>';
    html += '<div id="verif-result"></div>';
    html += "</div>";

    // Reference tables
    html += '<div class="card"><div class="card-title">Référentiel — Vitamines autorisées</div>';
    html += '<table class="data-table"><thead><tr><th>Vitamine</th><th>VNR</th><th>Dose max/jour</th><th>Note</th></tr></thead><tbody>';
    VITAMINES.forEach(function (v) {
      html += "<tr><td>" + v.nom + "</td><td>" + v.vnr + " " + v.unite + "</td><td>" + (v.doseMax || "—") + " " + v.unite + "</td><td style='font-size:11px;color:var(--color-text-muted);'>" + v.doseMaxNote + "</td></tr>";
    });
    html += "</tbody></table></div>";

    html += '<div class="card"><div class="card-title">Référentiel — Minéraux autorisés</div>';
    html += '<table class="data-table"><thead><tr><th>Minéral</th><th>VNR</th><th>Dose max/jour</th><th>Note</th></tr></thead><tbody>';
    MINERAUX.forEach(function (m) {
      html += "<tr><td>" + m.nom + "</td><td>" + (m.vnr || "—") + " " + m.unite + "</td><td>" + (m.doseMax || "—") + " " + m.unite + "</td><td style='font-size:11px;color:var(--color-text-muted);'>" + m.doseMaxNote + "</td></tr>";
    });
    html += "</tbody></table></div>";

    html += '<div class="card"><div class="card-title">Référentiel — Plantes autorisées (échantillon)</div>';
    html += '<table class="data-table"><thead><tr><th>Plante</th><th>Famille</th><th>Partie</th><th>Surveillance</th></tr></thead><tbody>';
    PLANTES.forEach(function (p) {
      html += "<tr><td><em>" + p.nom + "</em></td><td>" + p.famille + "</td><td>" + p.partie + "</td><td>" + (p.surveillance ? '<span class="badge badge-warning">' + p.surveillance + "</span>" : '<span class="badge badge-success">—</span>') + "</td></tr>";
    });
    html += "</tbody></table></div>";

    $("#main-content").innerHTML = html;

    // Events
    var typeEl = document.getElementById("verif-type");
    typeEl.addEventListener("change", function () {
      updateVerifDatalist(typeEl.value);
    });
    updateVerifDatalist("Vitamine");

    document.getElementById("verif-btn").addEventListener("click", function () {
      var nom = document.getElementById("verif-nom").value.trim();
      var type = document.getElementById("verif-type").value;
      var quantite = document.getElementById("verif-quantite").value;
      if (!nom) { showToast("Veuillez saisir un nom d'ingrédient."); return; }

      var result = checkIngredientCompliance({ nom: nom, type: type, quantite: quantite, unite: document.getElementById("verif-unite").value });
      var vnr = calculateVNR(nom, quantite);
      var cls = result.status === "success" ? "compliant" : (result.status === "warning" ? "warning" : "non-compliant");

      var resHtml = '<div class="formula-result ' + cls + '">';
      resHtml += '<div style="font-weight:600;margin-bottom:var(--space-2);">' + result.message + "</div>";
      if (vnr !== null) resHtml += '<div style="font-size:var(--text-sm);">%VNR : ' + vnr + "%</div>";
      var maxInfo = DOSE_MAX_MAP[nom];
      if (maxInfo) resHtml += '<div style="font-size:var(--text-sm);">Dose max journalière : ' + maxInfo.max + " " + maxInfo.unite + " (" + maxInfo.note + ")</div>";
      resHtml += "</div>";

      document.getElementById("verif-result").innerHTML = resHtml;
    });
  }

  function updateVerifDatalist(type) {
    var list = document.getElementById("verif-datalist");
    if (!list) return;
    var items = [];
    if (type === "Vitamine") items = AUTHORIZED_VITAMINS;
    else if (type === "Minéral") items = AUTHORIZED_MINERALS;
    else if (type === "Plante") items = AUTHORIZED_PLANTS;
    list.innerHTML = items.map(function (i) { return '<option value="' + esc(i) + '">'; }).join("");
  }

  /* ===== RENDER: ETIQUETAGE (Standalone) ===== */
  function renderEtiquetage() {
    var html = '<div class="page-header">' +
      '<h1 class="page-title">Étiquetage</h1>' +
      '<p class="page-subtitle">Vérifiez les mentions obligatoires d\'étiquetage pour les compléments alimentaires</p></div>';

    html += '<div class="card"><div class="card-title">Les 15 mentions obligatoires</div>';
    html += '<p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-4);">Conformément à la Directive 2002/46/CE et au Règlement INCO 1169/2011, tout complément alimentaire mis sur le marché français doit comporter les mentions suivantes :</p>';

    MENTIONS_OBLIGATOIRES.forEach(function (m, i) {
      html += '<div class="checklist-item">' +
        '<div class="checklist-icon pass" style="font-size:var(--text-xs);font-weight:700;">' + (i + 1) + "</div>" +
        "<div>" +
        '<div style="font-size:var(--text-sm);font-weight:500;">' + m.texte + "</div>" +
        '<div style="font-size:11px;color:var(--color-text-faint);margin-top:2px;">' + m.ref + "</div>" +
        "</div></div>";
    });
    html += "</div>";

    html += '<div class="card"><div class="card-title">Avertissements spécifiques</div>';
    html += '<div style="font-size:var(--text-sm);color:var(--color-text-muted);line-height:1.8;">';
    html += "• Produits contenant de la <strong>caféine</strong> : « Teneur élevée en caféine. Déconseillé aux enfants et aux femmes enceintes ou allaitantes. »<br>";
    html += "• Produits contenant des <strong>édulcorants</strong> (polyols > 10 g/jour) : « Une consommation excessive peut avoir des effets laxatifs. »<br>";
    html += "• Produits contenant du <strong>glycyrrhizinate d'ammonium / réglisse</strong> : avertissement si > 100 mg/jour.<br>";
    html += "• Produits contenant de la <strong>vitamine K</strong> : « Contient de la vitamine K — consulter un médecin en cas de traitement anticoagulant. »";
    html += "</div></div>";

    $("#main-content").innerHTML = html;
  }

  /* ===== RENDER: ALLEGATIONS ===== */
  function renderAllegations() {
    var html = '<div class="page-header">' +
      '<h1 class="page-title">Allégations santé</h1>' +
      '<p class="page-subtitle">Allégations autorisées par le Règlement 432/2012</p></div>';

    var substances = Object.keys(ALLEGATIONS);
    substances.forEach(function (sub) {
      html += '<div class="card"><div class="card-title">' + sub + "</div>";
      html += '<table class="data-table"><thead><tr><th>Allégation autorisée</th><th>Dose min/dose</th><th>% VNR requis</th></tr></thead><tbody>';
      ALLEGATIONS[sub].forEach(function (claim) {
        html += "<tr><td>« " + claim.texte + " »</td>" +
          "<td>" + claim.doseMin + " " + claim.unite + "</td>" +
          "<td>" + claim.pctVNR + "%</td></tr>";
      });
      html += "</tbody></table></div>";
    });

    $("#main-content").innerHTML = html;
  }

  /* ===== RENDER: BASE REGLEMENTAIRE ===== */
  function renderBaseReglementaire() {
    var html = '<div class="page-header">' +
      '<h1 class="page-title">Base réglementaire</h1>' +
      '<p class="page-subtitle">Textes applicables aux compléments alimentaires en France</p></div>';

    var sections = [
      { key: "francais", title: "Textes français" },
      { key: "europeens", title: "Règlements européens" },
      { key: "ressources", title: "Ressources et outils" }
    ];

    sections.forEach(function (section) {
      html += '<div class="reg-category"><div class="reg-category-title">' + section.title + "</div>";
      REGLEMENTS[section.key].forEach(function (reg) {
        html += '<div class="reg-item">' +
          '<div class="reg-item-title">' + reg.titre + "</div>" +
          '<div class="reg-item-desc">' + reg.desc + "</div>" +
          '<a href="' + reg.lien + '" target="_blank" rel="noopener noreferrer">Consulter le texte →</a>' +
          "</div>";
      });
      html += "</div>";
    });

    $("#main-content").innerHTML = html;
  }

  /* ===== RENDER: AIDE ===== */
  function renderAide() {
    var html = '<div class="page-header">' +
      '<h1 class="page-title">Aide</h1>' +
      '<p class="page-subtitle">Guide d\'utilisation de RégulCA</p></div>';

    html += '<div class="card"><div class="card-title">Comment utiliser RégulCA</div>';
    html += '<div style="font-size:var(--text-sm);color:var(--color-text-muted);line-height:1.8;">';
    html += "<p style='margin-bottom:var(--space-4);'><strong>RégulCA</strong> est un outil d'aide à la constitution de dossiers réglementaires pour les compléments alimentaires en France. Il vous guide à travers les étapes de la déclaration et vérifie la conformité de votre produit.</p>";
    html += '<ol style="list-style:decimal;padding-left:var(--space-5);margin-bottom:var(--space-4);">';
    html += "<li style='margin-bottom:var(--space-2);'><strong>Créez un nouveau dossier</strong> via le menu « Nouveau dossier ». L'assistant en 5 étapes vous guide.</li>";
    html += "<li style='margin-bottom:var(--space-2);'><strong>Renseignez les informations générales</strong> : nom commercial, catégorie, exploitant, fabricant.</li>";
    html += "<li style='margin-bottom:var(--space-2);'><strong>Saisissez votre formulation</strong> : chaque ingrédient est vérifié automatiquement contre les listes positives.</li>";
    html += "<li style='margin-bottom:var(--space-2);'><strong>Vérifiez l'étiquetage</strong> : les 15 mentions obligatoires sont listées avec prévisualisation.</li>";
    html += "<li style='margin-bottom:var(--space-2);'><strong>Sélectionnez vos allégations</strong> : seules les allégations autorisées par le Règlement 432/2012 sont proposées.</li>";
    html += "<li style='margin-bottom:var(--space-2);'><strong>Consultez le récapitulatif</strong> avec le score de conformité et la procédure applicable.</li>";
    html += "</ol></div></div>";

    html += '<div class="card"><div class="card-title">Questions fréquentes</div>';

    var faqs = [
      { q: "Quelle est la différence entre l'Article 15 et l'Article 16 ?", a: "L'Article 15 concerne la déclaration simple d'un produit 100% conforme aux listes positives françaises. L'Article 16 s'applique lorsqu'un ingrédient est légalement commercialisé dans un autre État membre de l'UE mais non listé en France (reconnaissance mutuelle). L'Article 17-18 concerne les demandes d'ajout de nouveaux ingrédients." },
      { q: "Qu'est-ce que la VNR et comment est-elle calculée ?", a: "La Valeur Nutritionnelle de Référence (VNR) est définie par le Règlement INCO 1169/2011, Annexe XIII. Le %VNR indique quelle proportion de l'apport de référence est couverte par la dose du complément. Par exemple, si un produit contient 40 mg de vitamine C par dose et la VNR est de 80 mg, le %VNR est de 50%." },
      { q: "Où déclarer mon complément alimentaire ?", a: "La déclaration se fait via la plateforme Compl'Alim (complalim.anses.fr), gérée par la DGAL. Un modèle d'étiquetage complet doit être joint à la déclaration." },
      { q: "Les données sont-elles sauvegardées ?", a: "Les données sont conservées en mémoire pendant votre session. Elles ne sont pas transmises à un serveur. RégulCA est un outil d'aide à la constitution de dossiers, pas un outil de soumission officielle." },
      { q: "Comment savoir si ma plante est autorisée ?", a: "Consultez l'arrêté du 24 juin 2014 qui liste les plantes autorisées dans les compléments alimentaires. L'outil « Vérification formule » vous permet de vérifier rapidement un ingrédient." }
    ];

    faqs.forEach(function (faq, i) {
      html += '<div class="faq-item" data-faq="' + i + '">' +
        '<div class="faq-question" onclick="window._toggleFaq(' + i + ')">' +
        "<span>" + faq.q + "</span>" +
        '<svg class="faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
        "</div>" +
        '<div class="faq-answer"><p>' + faq.a + "</p></div></div>";
    });
    html += "</div>";

    $("#main-content").innerHTML = html;
  }

  window._toggleFaq = function (i) {
    var item = document.querySelector('[data-faq="' + i + '"]');
    if (item) item.classList.toggle("open");
  };

  /* ===== FORM HELPERS ===== */
  function formField(id, label, type, value, placeholder) {
    return '<div class="form-group">' +
      '<label class="form-label" for="field-' + id + '">' + label + "</label>" +
      '<input class="form-input" id="field-' + id + '" type="' + type + '" value="' + esc(value || "") + '" placeholder="' + esc(placeholder || "") + '">' +
      "</div>";
  }

  function formSelect(id, label, options, selected) {
    var html = '<div class="form-group">' +
      '<label class="form-label" for="field-' + id + '">' + label + "</label>" +
      '<select class="form-select" id="field-' + id + '">' +
      '<option value="">— Sélectionner —</option>';
    options.forEach(function (opt) {
      html += '<option value="' + esc(opt) + '"' + (opt === selected ? " selected" : "") + ">" + opt + "</option>";
    });
    html += "</select></div>";
    return html;
  }

  function optionsHtml(options, selected) {
    return options.map(function (opt) {
      return '<option value="' + esc(opt) + '"' + (opt === selected ? " selected" : "") + ">" + opt + "</option>";
    }).join("");
  }

  function esc(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ===== VEILLE RÉGLEMENTAIRE ===== */

  var veilleState = {
    tab: "alertes",
    filters: { categorie: "", impact: "", source: "", q: "" },
    stats: null,
    alertes: [],
    sources: [],
    scanBanner: null
  };

  function veilleFetch(path, opts) {
    return authFetch(API_BASE + path, opts).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function updateVeilleBadge() {
    veilleFetch("/api/veille/stats").then(function (stats) {
      var badge = document.getElementById("veille-badge");
      if (!badge) return;
      if (stats.non_lues > 0) {
        badge.textContent = stats.non_lues;
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }).catch(function () {
      /* silently ignore */
    });
  }

  function formatDateVeille(dateStr) {
    if (!dateStr) return "—";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  function renderVeille() {
    var main = $("#main-content");
    main.innerHTML = '<div class="veille-header">' +
      '<h1 class="page-title">Veille réglementaire</h1>' +
      '<p class="page-subtitle">Surveillance en temps réel des évolutions réglementaires</p>' +
      '</div>' +
      '<div id="veille-kpis"><div class="veille-kpi">Chargement…</div></div>' +
      '<div id="veille-scan-banner"></div>' +
      '<div id="veille-actions-bar"></div>' +
      '<div id="veille-tabs-bar"></div>' +
      '<div id="veille-body">Chargement…</div>';

    loadVeilleData();
  }

  function loadVeilleData() {
    var params = [];
    if (veilleState.filters.categorie) params.push("categorie=" + encodeURIComponent(veilleState.filters.categorie));
    if (veilleState.filters.impact) params.push("impact=" + encodeURIComponent(veilleState.filters.impact));
    if (veilleState.filters.source) params.push("source=" + encodeURIComponent(veilleState.filters.source));
    if (veilleState.filters.q) params.push("q=" + encodeURIComponent(veilleState.filters.q));
    var qs = params.length ? "?" + params.join("&") : "";

    Promise.all([
      veilleFetch("/api/veille/stats"),
      veilleFetch("/api/veille" + qs),
      veilleFetch("/api/veille/sources")
    ]).then(function (results) {
      veilleState.stats = results[0];
      veilleState.alertes = results[1].alertes || [];
      veilleState.sources = (results[2].sources || []);
      renderVeilleKPIs();
      renderVeilleActions();
      renderVeilleTabs();
      renderVeilleBody();
      updateVeilleBadge();
    }).catch(function () {
      var body = document.getElementById("veille-body");
      if (body) {
        body.innerHTML = '<div class="veille-empty">' +
          '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
          '<p>Serveur de veille non disponible</p>' +
          '</div>';
      }
      var kpis = document.getElementById("veille-kpis");
      if (kpis) kpis.innerHTML = '';
    });
  }

  function renderVeilleKPIs() {
    var s = veilleState.stats;
    if (!s) return;
    var el = document.getElementById("veille-kpis");
    if (!el) return;
    el.innerHTML = '<div class="veille-kpi-row">' +
      '<span class="veille-kpi">Total alertes <strong>' + s.total_alertes + '</strong></span>' +
      '<span class="veille-kpi veille-kpi--nonlues">Non lues <strong>' + s.non_lues + '</strong></span>' +
      '<span class="veille-kpi veille-kpi--critique">Critiques <strong>' + s.critiques + '</strong></span>' +
      '<span class="veille-kpi veille-kpi--important">Importants <strong>' + s.importants + '</strong></span>' +
      '</div>';
  }

  function renderVeilleActions() {
    var el = document.getElementById("veille-actions-bar");
    if (!el) return;
    el.innerHTML = '<div class="veille-actions">' +
      '<button class="btn btn-primary btn-sm" id="btn-veille-scan">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
        ' Lancer un scan' +
      '</button>' +
      '<button class="btn btn-secondary btn-sm" id="btn-veille-mark-all">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
        ' Tout marquer comme lu' +
      '</button>' +
      '</div>';

    document.getElementById("btn-veille-scan").addEventListener("click", handleVeilleScan);
    document.getElementById("btn-veille-mark-all").addEventListener("click", handleVeilleMarkAllRead);
  }

  function renderVeilleTabs() {
    var el = document.getElementById("veille-tabs-bar");
    if (!el) return;
    el.innerHTML = '<div class="veille-tabs">' +
      '<button class="veille-tab' + (veilleState.tab === "alertes" ? " active" : "") + '" data-veille-tab="alertes">Alertes</button>' +
      '<button class="veille-tab' + (veilleState.tab === "sources" ? " active" : "") + '" data-veille-tab="sources">Sources</button>' +
      '</div>';

    el.querySelectorAll(".veille-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        veilleState.tab = btn.getAttribute("data-veille-tab");
        renderVeilleTabs();
        renderVeilleBody();
      });
    });
  }

  function renderVeilleBody() {
    var el = document.getElementById("veille-body");
    if (!el) return;
    if (veilleState.tab === "alertes") {
      renderVeilleAlertes(el);
    } else {
      renderVeilleSources(el);
    }
  }

  function renderVeilleAlertes(container) {
    var s = veilleState.stats;
    var html = '';

    // Filters
    html += '<div class="veille-filters">';
    html += '<select class="form-select" id="veille-filter-categorie"><option value="">Toutes catégories</option>';
    if (s && s.by_category) {
      s.by_category.forEach(function (c) {
        html += '<option value="' + esc(c.categorie) + '"' + (veilleState.filters.categorie === c.categorie ? ' selected' : '') + '>' + esc(c.categorie) + ' (' + c.count + ')</option>';
      });
    }
    html += '</select>';

    html += '<select class="form-select" id="veille-filter-impact"><option value="">Tous impacts</option>';
    ["critique", "important", "info"].forEach(function (imp) {
      var label = imp.charAt(0).toUpperCase() + imp.slice(1);
      html += '<option value="' + imp + '"' + (veilleState.filters.impact === imp ? ' selected' : '') + '>' + label + '</option>';
    });
    html += '</select>';

    html += '<select class="form-select" id="veille-filter-source"><option value="">Toutes sources</option>';
    if (s && s.by_source) {
      s.by_source.forEach(function (src) {
        html += '<option value="' + esc(src.source) + '"' + (veilleState.filters.source === src.source ? ' selected' : '') + '>' + esc(src.source) + ' (' + src.count + ')</option>';
      });
    }
    html += '</select>';

    html += '<input type="text" class="form-input" id="veille-filter-q" placeholder="Rechercher…" value="' + esc(veilleState.filters.q) + '">';
    html += '</div>';

    // Scan banner
    if (veilleState.scanBanner) {
      html += veilleState.scanBanner;
    }

    // Timeline
    if (veilleState.alertes.length === 0) {
      html += '<div class="veille-empty">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<p>Aucune alerte ne correspond aux filtres sélectionnés</p>' +
        '</div>';
    } else {
      html += '<div class="veille-timeline">';
      veilleState.alertes.forEach(function (a) {
        var impactClass = "alerte-impact-" + a.impact;
        var unreadClass = a.lu ? "" : " unread";
        var impactTagClass = "alerte-impact-tag--" + a.impact;
        var impactLabel = a.impact === "critique" ? "Critique" : (a.impact === "important" ? "Important" : "Info");

        html += '<div class="alerte-card ' + impactClass + unreadClass + '" data-alerte-id="' + a.id + '">';
        html += '<div class="alerte-card-header">';
        html += '<span class="alerte-source-badge">' + esc(a.source) + '</span>';
        html += '<span class="alerte-category-tag">' + esc(a.categorie) + '</span>';
        html += '<span class="alerte-impact-tag ' + impactTagClass + '">' + impactLabel + '</span>';
        html += '<span class="alerte-date">' + formatDateVeille(a.date_publication) + '</span>';
        html += '</div>';
        html += '<div class="alerte-title">' + esc(a.titre) + '</div>';
        html += '<div class="alerte-summary collapsed" data-summary-id="' + a.id + '">' + esc(a.resume) + '</div>';
        html += '<button class="expand-btn" data-expand-id="' + a.id + '">Voir plus ↓</button>';

        html += '<div class="alerte-footer">';
        if (a.textes_concernes) {
          a.textes_concernes.split(",").forEach(function (t) {
            t = t.trim();
            if (t) html += '<span class="alerte-texte-pill">' + esc(t) + '</span>';
          });
        }
        html += '<a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer" class="alerte-link" onclick="event.stopPropagation();">Consulter →</a>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Bind filter events
    var debounceTimer;
    var filterCat = document.getElementById("veille-filter-categorie");
    var filterImp = document.getElementById("veille-filter-impact");
    var filterSrc = document.getElementById("veille-filter-source");
    var filterQ = document.getElementById("veille-filter-q");

    function applyFilters() {
      veilleState.filters.categorie = filterCat ? filterCat.value : "";
      veilleState.filters.impact = filterImp ? filterImp.value : "";
      veilleState.filters.source = filterSrc ? filterSrc.value : "";
      veilleState.filters.q = filterQ ? filterQ.value : "";
      loadVeilleData();
    }

    if (filterCat) filterCat.addEventListener("change", applyFilters);
    if (filterImp) filterImp.addEventListener("change", applyFilters);
    if (filterSrc) filterSrc.addEventListener("change", applyFilters);
    if (filterQ) filterQ.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 400);
    });

    // Bind card click → mark as read
    container.querySelectorAll(".alerte-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-alerte-id");
        if (card.classList.contains("unread")) {
          veilleFetch("/api/veille/mark-read/" + id, { method: "POST" }).then(function () {
            card.classList.remove("unread");
            updateVeilleBadge();
            // Update local state
            veilleState.alertes.forEach(function (a) {
              if (String(a.id) === String(id)) a.lu = 1;
            });
            if (veilleState.stats) {
              veilleState.stats.non_lues = Math.max(0, veilleState.stats.non_lues - 1);
              renderVeilleKPIs();
            }
          }).catch(function () { /* ignore */ });
        }
      });
    });

    // Bind expand buttons
    container.querySelectorAll(".expand-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-expand-id");
        var summary = container.querySelector('[data-summary-id="' + id + '"]');
        if (summary) {
          var isCollapsed = summary.classList.contains("collapsed");
          summary.classList.toggle("collapsed");
          btn.textContent = isCollapsed ? "Voir moins ↑" : "Voir plus ↓";
        }
      });
    });
  }

  function renderVeilleSources(container) {
    var sources = veilleState.sources;
    if (sources.length === 0) {
      container.innerHTML = '<div class="veille-empty"><p>Aucune source configurée</p></div>';
      return;
    }
    var html = '<div class="veille-sources-grid">';
    sources.forEach(function (src) {
      var dotClass = src.statut === "actif" ? "active" : "inactive";
      var lastCheck = src.derniere_verification ? formatDateVeille(src.derniere_verification) : "Jamais vérifié";
      html += '<div class="source-card">';
      html += '<div class="source-card-header">';
      html += '<span class="source-status-dot ' + dotClass + '"></span>';
      html += '<span class="source-card-name">' + esc(src.nom) + '</span>';
      html += '</div>';
      html += '<div class="source-card-type">' + esc(src.type) + '</div>';
      html += '<a href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer" class="source-card-url">' + esc(src.url) + '</a>';
      html += '<div class="source-card-check">Dernière vérification : ' + lastCheck + '</div>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function handleVeilleScan() {
    var btn = document.getElementById("btn-veille-scan");
    if (!btn) return;
    var svgEl = btn.querySelector("svg");
    btn.disabled = true;
    if (svgEl) svgEl.classList.add("spin");

    veilleFetch("/api/veille/refresh", { method: "POST" }).then(function (result) {
      btn.disabled = false;
      if (svgEl) svgEl.classList.remove("spin");
      var totalNew = result.total_new || 0;
      var details = [];
      if (result.sources) {
        Object.keys(result.sources).forEach(function (key) {
          var s = result.sources[key];
          if (s.new_alerts > 0) details.push(key + " : " + s.new_alerts);
        });
      }
      veilleState.scanBanner = '<div class="scan-result">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
        'Scan terminé — ' + totalNew + ' nouvelle(s) alerte(s)' +
        (details.length ? ' (' + details.join(", ") + ')' : '') +
        '</div>';
      loadVeilleData();
    }).catch(function () {
      btn.disabled = false;
      if (svgEl) svgEl.classList.remove("spin");
      veilleState.scanBanner = '<div class="scan-result error">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        'Erreur lors du scan' +
        '</div>';
      var banner = document.getElementById("veille-scan-banner");
      if (banner) banner.innerHTML = veilleState.scanBanner;
    });
  }

  function handleVeilleMarkAllRead() {
    veilleFetch("/api/veille/mark-all-read", { method: "POST" }).then(function () {
      loadVeilleData();
    }).catch(function () {
      showToast("Erreur lors du marquage");
    });
  }

  /* ===== DASHBOARD: Alertes récentes ===== */
  function renderDashboardAlertes() {
    veilleFetch("/api/veille?limit=3").then(function (data) {
      var container = document.getElementById("dashboard-alertes");
      if (!container) return;
      var alertes = data.alertes || [];
      if (alertes.length === 0) {
        container.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-text-muted);">Aucune alerte récente</p>';
        return;
      }
      var html = '<div class="dashboard-alertes-list">';
      alertes.forEach(function (a) {
        html += '<div class="dashboard-alerte ' + a.impact + '">';
        html += '<div class="dashboard-alerte-content">';
        html += '<div class="dashboard-alerte-title">' + esc(a.titre) + '</div>';
        html += '<div class="dashboard-alerte-meta">' + esc(a.source) + ' · ' + formatDateVeille(a.date_publication) + '</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="margin-top:var(--space-3);"><a href="#veille" class="btn btn-ghost btn-sm">Voir toutes les alertes →</a></div>';
      container.innerHTML = html;
    }).catch(function () {
      var container = document.getElementById("dashboard-alertes");
      if (container) container.innerHTML = '<p style="font-size:var(--text-xs);color:var(--color-text-faint);">Veille non disponible</p>';
    });
  }

  /* ===== INIT ===== */
  function init() {
    /* Vérifier l'authentification avant tout */
    checkAuth();
    initTheme();
    initSidebar();
    /* Charger les dossiers depuis l'API avant le premier rendu */
    loadDossiers(function () {
      initRouter();
    });
    updateVeilleBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
