/* ===== RégulCA — Module Médicament Frontend ===== */
/* Render functions pour CTD, Variations, Traduction, Veille Médicament */

/* global authFetch, API_BASE, navigateTo */

(function () {
  "use strict";

  /* ===== HELPERS ===== */
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function statusBadgeMed(statut) {
    var map = {
      "brouillon": "badge-neutral",
      "en_cours": "badge-primary",
      "soumis": "badge-accent",
      "approuve": "badge-success",
      "rejete": "badge-warning"
    };
    return '<span class="badge ' + (map[statut] || "badge-neutral") + '">' + escapeHtml(statut) + "</span>";
  }

  /* ===== RENDER: DOSSIER CTD ===== */
  window.renderDossierCTD = function () {
    var main = document.getElementById("main-content");
    main.innerHTML =
      '<div class="page-header">' +
        '<h1 class="page-title">Dossier CTD</h1>' +
        '<p class="page-subtitle">Créer un nouveau dossier Common Technical Document</p>' +
      '</div>' +
      '<div class="card" style="padding:1.5rem;">' +
        '<form id="ctd-form">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
            '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Nom du médicament *</label>' +
              '<input type="text" id="ctd-nom" required style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;"></div>' +
            '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">DCI *</label>' +
              '<input type="text" id="ctd-dci" required style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;"></div>' +
            '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Forme pharmaceutique</label>' +
              '<select id="ctd-forme" style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;">' +
                '<option value="">Sélectionner</option>' +
                '<option>Comprimé</option><option>Gélule</option><option>Solution buvable</option>' +
                '<option>Injectable</option><option>Crème</option><option>Suppositoire</option>' +
                '<option>Patch</option><option>Collyre</option><option>Spray nasal</option>' +
              '</select></div>' +
            '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Dosage *</label>' +
              '<input type="text" id="ctd-dosage" placeholder="ex: 500 mg" required style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;"></div>' +
            '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Type de procédure *</label>' +
              '<select id="ctd-procedure" required style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;">' +
                '<option value="">Sélectionner</option>' +
                '<option value="nationale">Nationale</option><option value="MRP">MRP</option>' +
                '<option value="DCP">DCP</option><option value="centralisée">Centralisée</option>' +
              '</select></div>' +
            '<div><label style="display:block;font-weight:500;margin-bottom:0.25rem;">Classe ATC</label>' +
              '<input type="text" id="ctd-atc" placeholder="ex: N02BE01" style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;"></div>' +
          '</div>' +
          '<div style="margin-top:1.5rem;">' +
            '<label style="display:block;font-weight:500;margin-bottom:0.25rem;">Indication thérapeutique</label>' +
            '<textarea id="ctd-indication" rows="3" style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;resize:vertical;"></textarea>' +
          '</div>' +
          '<div style="margin-top:1rem;display:flex;gap:0.75rem;">' +
            '<button type="submit" class="btn btn-primary" style="padding:0.625rem 1.5rem;border:none;border-radius:8px;background:var(--color-primary);color:#fff;font-weight:600;cursor:pointer;">Créer le dossier CTD</button>' +
          '</div>' +
          '<div id="ctd-form-msg" style="margin-top:0.75rem;"></div>' +
        '</form>' +
      '</div>';

    document.getElementById("ctd-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nom = document.getElementById("ctd-nom").value.trim();
      var dci = document.getElementById("ctd-dci").value.trim();
      var procedure = document.getElementById("ctd-procedure").value;
      if (!nom || !dci || !procedure) return;

      var id = "CTD-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
      var body = {
        id: id,
        nom_medicament: nom,
        dci: dci,
        type_procedure: procedure,
        forme_pharmaceutique: document.getElementById("ctd-forme").value,
        dosage: document.getElementById("ctd-dosage").value,
        classe_atc: document.getElementById("ctd-atc").value,
        indication_therapeutique: document.getElementById("ctd-indication").value,
        titulaire_amm: "Bailly Creat",
        exploitant: "Bailly Creat"
      };

      var msg = document.getElementById("ctd-form-msg");
      msg.innerHTML = '<span style="color:var(--color-text-secondary);">Création en cours...</span>';

      authFetch(API_BASE + "/api/ctd/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.ok) {
          msg.innerHTML = '<span style="color:var(--color-success);">Dossier ' + escapeHtml(id) + ' créé avec succès.</span>';
          setTimeout(function () { navigateTo("mes-dossiers-ctd"); }, 1000);
        } else {
          msg.innerHTML = '<span style="color:var(--color-danger);">' + escapeHtml(data.error || "Erreur") + '</span>';
        }
      }).catch(function () {
        msg.innerHTML = '<span style="color:var(--color-danger);">Erreur de connexion au serveur.</span>';
      });
    });
  };

  /* ===== RENDER: MES DOSSIERS CTD ===== */
  window.renderMesDossiersCTD = function () {
    var main = document.getElementById("main-content");
    main.innerHTML =
      '<div class="page-header">' +
        '<h1 class="page-title">Mes dossiers CTD</h1>' +
        '<p class="page-subtitle">Dossiers Common Technical Document</p>' +
      '</div>' +
      '<div id="ctd-list"><p style="color:var(--color-text-secondary);">Chargement...</p></div>';

    authFetch(API_BASE + "/api/ctd/dossiers").then(function (r) { return r.json(); }).then(function (data) {
      var container = document.getElementById("ctd-list");
      var dossiers = data.dossiers || [];
      if (dossiers.length === 0) {
        container.innerHTML =
          '<div class="card" style="padding:2rem;text-align:center;">' +
            '<p style="color:var(--color-text-secondary);">Aucun dossier CTD. <a href="#dossier-ctd" style="color:var(--color-primary);">Créer un dossier</a></p>' +
          '</div>';
        return;
      }
      var html = '<div class="table-container"><table class="data-table"><thead><tr>' +
        '<th>ID</th><th>Médicament</th><th>DCI</th><th>Procédure</th><th>Statut</th><th>Modifié</th></tr></thead><tbody>';
      dossiers.forEach(function (d) {
        html += '<tr style="cursor:pointer;" onclick="navigateTo(\'voir-ctd/' + escapeHtml(d.id) + '\')">' +
          '<td><strong>' + escapeHtml(d.id) + '</strong></td>' +
          '<td>' + escapeHtml(d.nom_medicament) + '</td>' +
          '<td>' + escapeHtml(d.dci) + '</td>' +
          '<td>' + escapeHtml(d.type_procedure) + '</td>' +
          '<td>' + statusBadgeMed(d.statut) + '</td>' +
          '<td>' + escapeHtml((d.date_modification || "").substring(0, 10)) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;
    }).catch(function () {
      document.getElementById("ctd-list").innerHTML =
        '<div class="card" style="padding:1.5rem;"><p style="color:var(--color-danger);">Erreur de chargement des dossiers.</p></div>';
    });
  };

  /* ===== RENDER: VARIATIONS ===== */
  window.renderVariations = function () {
    var main = document.getElementById("main-content");
    main.innerHTML =
      '<div class="page-header">' +
        '<h1 class="page-title">Variations IA/IB/II</h1>' +
        '<p class="page-subtitle">Classifier et gérer les variations réglementaires</p>' +
      '</div>' +
      '<div class="card" style="padding:1.5rem;margin-bottom:1.5rem;">' +
        '<h3 style="margin-bottom:1rem;">Classification IA — Description libre</h3>' +
        '<p style="font-size:0.875rem;color:var(--color-text-secondary);margin-bottom:0.75rem;">Décrivez le changement en langage naturel. L\'IA classifiera automatiquement la variation.</p>' +
        '<textarea id="var-description" rows="3" placeholder="Ex: On change le fournisseur du magnésium stéarate dans le comprimé..." style="width:100%;padding:0.5rem;border:1px solid var(--color-border);border-radius:6px;resize:vertical;box-sizing:border-box;"></textarea>' +
        '<div style="margin-top:0.75rem;display:flex;gap:0.75rem;align-items:center;">' +
          '<button id="var-classify-btn" class="btn btn-primary" style="padding:0.5rem 1.25rem;border:none;border-radius:8px;background:var(--color-primary);color:#fff;font-weight:600;cursor:pointer;">Classifier avec l\'IA</button>' +
          '<span id="var-classify-status" style="font-size:0.875rem;color:var(--color-text-secondary);"></span>' +
        '</div>' +
        '<div id="var-classify-result" style="margin-top:1rem;"></div>' +
      '</div>' +
      '<div class="card" style="padding:1.5rem;margin-bottom:1.5rem;">' +
        '<h3 style="margin-bottom:1rem;">Catalogue des variations</h3>' +
        '<div id="var-catalogue"><p style="color:var(--color-text-secondary);">Chargement...</p></div>' +
      '</div>' +
      '<div class="card" style="padding:1.5rem;">' +
        '<h3 style="margin-bottom:1rem;">Mes variations</h3>' +
        '<div id="var-list"><p style="color:var(--color-text-secondary);">Chargement...</p></div>' +
      '</div>';

    /* Classifier avec l'IA */
    document.getElementById("var-classify-btn").addEventListener("click", function () {
      var desc = document.getElementById("var-description").value.trim();
      if (!desc) return;
      var status = document.getElementById("var-classify-status");
      var result = document.getElementById("var-classify-result");
      status.textContent = "Classification en cours...";
      result.innerHTML = "";

      authFetch(API_BASE + "/api/variations/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc })
      }).then(function (r) { return r.json(); }).then(function (data) {
        status.textContent = "";
        if (data.error) {
          result.innerHTML = '<p style="color:var(--color-danger);">' + escapeHtml(data.error) + '</p>';
          return;
        }
        var c = data.classification;
        result.innerHTML =
          '<div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:8px;padding:1rem;">' +
            '<p><strong>Classification :</strong> ' + escapeHtml(c.categorie || "") + ' — ' + escapeHtml(c.sous_categorie || "") + '</p>' +
            '<p><strong>Type :</strong> <span class="badge badge-primary">' + escapeHtml(c.type_variation || "") + '</span></p>' +
            '<p><strong>Titre :</strong> ' + escapeHtml(c.titre || "") + '</p>' +
            '<p><strong>Justification :</strong> ' + escapeHtml(c.justification || "") + '</p>' +
            '<p><strong>Délai :</strong> ' + escapeHtml(c.delai_reglementaire || "") + '</p>' +
            (c.documents_requis ? '<p><strong>Documents requis :</strong></p><ul>' + c.documents_requis.map(function (d) { return '<li>' + escapeHtml(d) + '</li>'; }).join("") + '</ul>' : '') +
          '</div>';
      }).catch(function () {
        status.textContent = "";
        result.innerHTML = '<p style="color:var(--color-danger);">Erreur de connexion.</p>';
      });
    });

    /* Charger le catalogue */
    authFetch(API_BASE + "/api/variations/catalogue").then(function (r) { return r.json(); }).then(function (data) {
      var container = document.getElementById("var-catalogue");
      var cats = data.catalogue || [];
      var html = "";
      cats.forEach(function (cat) {
        html += '<details style="margin-bottom:0.5rem;"><summary style="cursor:pointer;font-weight:600;padding:0.375rem 0;">' +
          escapeHtml(cat.code + " — " + cat.titre) + ' (' + cat.variations.length + ')</summary>' +
          '<div style="padding:0.5rem 0 0.5rem 1rem;">';
        cat.variations.forEach(function (v) {
          html += '<div style="padding:0.375rem 0;border-bottom:1px solid var(--color-border);">' +
            '<strong>' + escapeHtml(v.code) + '</strong> ' + escapeHtml(v.titre) +
            ' — <span class="badge badge-neutral">' + escapeHtml(v.types_possibles.join(" / ")) + '</span>' +
            '</div>';
        });
        html += '</div></details>';
      });
      container.innerHTML = html;
    }).catch(function () {
      document.getElementById("var-catalogue").innerHTML = '<p style="color:var(--color-danger);">Erreur de chargement.</p>';
    });

    /* Charger les variations existantes */
    authFetch(API_BASE + "/api/variations/dossiers").then(function (r) { return r.json(); }).then(function (data) {
      var container = document.getElementById("var-list");
      var vars = data.variations || [];
      if (vars.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-secondary);">Aucune variation enregistrée.</p>';
        return;
      }
      var html = '<div class="table-container"><table class="data-table"><thead><tr>' +
        '<th>ID</th><th>Catégorie</th><th>Type</th><th>Description</th><th>Statut</th></tr></thead><tbody>';
      vars.forEach(function (v) {
        html += '<tr>' +
          '<td>' + escapeHtml(v.id) + '</td>' +
          '<td>' + escapeHtml(v.categorie) + '</td>' +
          '<td><span class="badge badge-primary">' + escapeHtml(v.type_variation) + '</span></td>' +
          '<td>' + escapeHtml((v.description || "").substring(0, 60)) + '</td>' +
          '<td>' + statusBadgeMed(v.statut) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;
    }).catch(function () {
      document.getElementById("var-list").innerHTML = '<p style="color:var(--color-danger);">Erreur de chargement.</p>';
    });
  };

  /* ===== RENDER: TRADUCTION FR↔EN ===== */
  window.renderTraduction = function () {
    var main = document.getElementById("main-content");
    main.innerHTML =
      '<div class="page-header">' +
        '<h1 class="page-title">Traduction FR↔EN</h1>' +
        '<p class="page-subtitle">Traduction avec terminologie pharmaceutique réglementaire</p>' +
      '</div>' +
      '<div class="card" style="padding:1.5rem;margin-bottom:1.5rem;">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">' +
          '<div>' +
            '<label style="display:block;font-weight:600;margin-bottom:0.375rem;" id="trad-src-label">Français</label>' +
            '<textarea id="trad-source" rows="8" placeholder="Saisissez le texte à traduire..." style="width:100%;padding:0.75rem;border:1px solid var(--color-border);border-radius:6px;resize:vertical;box-sizing:border-box;font-size:0.9375rem;"></textarea>' +
          '</div>' +
          '<div>' +
            '<label style="display:block;font-weight:600;margin-bottom:0.375rem;" id="trad-tgt-label">English</label>' +
            '<textarea id="trad-target" rows="8" readonly placeholder="La traduction apparaîtra ici..." style="width:100%;padding:0.75rem;border:1px solid var(--color-border);border-radius:6px;resize:vertical;box-sizing:border-box;font-size:0.9375rem;background:var(--color-bg);"></textarea>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:1rem;display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">' +
          '<button id="trad-btn" class="btn btn-primary" style="padding:0.5rem 1.25rem;border:none;border-radius:8px;background:var(--color-primary);color:#fff;font-weight:600;cursor:pointer;">Traduire</button>' +
          '<button id="trad-copy" style="padding:0.5rem 1rem;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);cursor:pointer;">Copier la traduction</button>' +
          '<button id="trad-swap" style="padding:0.5rem 1rem;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);cursor:pointer;">Inverser FR↔EN</button>' +
          '<label style="font-size:0.875rem;display:flex;align-items:center;gap:0.375rem;">' +
            '<input type="checkbox" id="trad-pharma" checked> Terminologie pharmaceutique</label>' +
          '<span id="trad-status" style="font-size:0.875rem;color:var(--color-text-secondary);"></span>' +
        '</div>' +
        '<div id="trad-terms" style="margin-top:1rem;"></div>' +
      '</div>' +
      '<div class="card" style="padding:1.5rem;">' +
        '<h3 style="margin-bottom:1rem;">Glossaire réglementaire</h3>' +
        '<div id="glossaire-list"><p style="color:var(--color-text-secondary);">Chargement...</p></div>' +
      '</div>';

    var srcLang = "fr";
    var tgtLang = "en";

    /* Inverser les langues */
    document.getElementById("trad-swap").addEventListener("click", function () {
      var tmp = srcLang;
      srcLang = tgtLang;
      tgtLang = tmp;
      document.getElementById("trad-src-label").textContent = srcLang === "fr" ? "Français" : "English";
      document.getElementById("trad-tgt-label").textContent = tgtLang === "en" ? "English" : "Français";
      var srcText = document.getElementById("trad-source").value;
      document.getElementById("trad-source").value = document.getElementById("trad-target").value;
      document.getElementById("trad-target").value = srcText;
    });

    /* Copier */
    document.getElementById("trad-copy").addEventListener("click", function () {
      var text = document.getElementById("trad-target").value;
      if (text) navigator.clipboard.writeText(text);
    });

    /* Traduire */
    document.getElementById("trad-btn").addEventListener("click", function () {
      var text = document.getElementById("trad-source").value.trim();
      if (!text) return;
      var status = document.getElementById("trad-status");
      status.textContent = "Traduction en cours...";
      document.getElementById("trad-target").value = "";
      document.getElementById("trad-terms").innerHTML = "";

      authFetch(API_BASE + "/api/translate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          source_lang: srcLang,
          target_lang: tgtLang,
          pharma_mode: document.getElementById("trad-pharma").checked
        })
      }).then(function (r) { return r.json(); }).then(function (data) {
        status.textContent = "";
        if (data.error) {
          status.textContent = data.error;
          status.style.color = "var(--color-danger)";
          return;
        }
        var t = data.translation;
        document.getElementById("trad-target").value = t.translated_text || "";
        if (t.glossary_terms && t.glossary_terms.length) {
          var html = '<p style="font-size:0.8125rem;font-weight:600;margin-bottom:0.375rem;">Termes spécialisés :</p><div style="display:flex;flex-wrap:wrap;gap:0.375rem;">';
          t.glossary_terms.forEach(function (term) {
            html += '<span class="badge badge-neutral" style="font-size:0.75rem;">' +
              escapeHtml(term.source) + ' → ' + escapeHtml(term.target) + '</span>';
          });
          html += '</div>';
          document.getElementById("trad-terms").innerHTML = html;
        }
      }).catch(function () {
        status.textContent = "Erreur de connexion.";
        status.style.color = "var(--color-danger)";
      });
    });

    /* Charger le glossaire */
    authFetch(API_BASE + "/api/translate/glossary").then(function (r) { return r.json(); }).then(function (data) {
      var container = document.getElementById("glossaire-list");
      var terms = data.glossaire || [];
      if (terms.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-secondary);">Glossaire vide.</p>';
        return;
      }
      var html = '<div class="table-container"><table class="data-table"><thead><tr>' +
        '<th>Français</th><th>English</th><th>Contexte</th></tr></thead><tbody>';
      terms.forEach(function (t) {
        html += '<tr><td>' + escapeHtml(t.terme_fr) + '</td><td>' + escapeHtml(t.terme_en) + '</td>' +
          '<td><span class="badge badge-neutral">' + escapeHtml(t.contexte || "") + '</span></td></tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;
    }).catch(function () {
      document.getElementById("glossaire-list").innerHTML = '<p style="color:var(--color-danger);">Erreur de chargement.</p>';
    });
  };

  /* ===== RENDER: VEILLE MÉDICAMENT ===== */
  window.renderVeilleMedicament = function () {
    var main = document.getElementById("main-content");
    main.innerHTML =
      '<div class="page-header">' +
        '<h1 class="page-title">Veille réglementaire — Médicaments</h1>' +
        '<p class="page-subtitle">Sources : ANSM, EMA, ICH, FDA, HAS, EDQM, OMS</p>' +
      '</div>' +
      '<div id="veille-med-kpis" style="margin-bottom:1.5rem;"></div>' +
      '<div class="card" style="padding:1.5rem;margin-bottom:1rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
          '<h3>Alertes récentes</h3>' +
          '<button id="veille-med-refresh" style="padding:0.5rem 1rem;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);cursor:pointer;font-size:0.875rem;">Actualiser les sources</button>' +
        '</div>' +
        '<div id="veille-med-list"><p style="color:var(--color-text-secondary);">Chargement...</p></div>' +
      '</div>';

    /* KPIs */
    authFetch(API_BASE + "/api/veille/medicament/stats").then(function (r) { return r.json(); }).then(function (stats) {
      var container = document.getElementById("veille-med-kpis");
      container.innerHTML =
        '<div class="kpi-grid">' +
          '<div class="kpi-card"><div class="kpi-value">' + stats.total_alertes + '</div><div class="kpi-label">Total alertes</div></div>' +
          '<div class="kpi-card"><div class="kpi-value">' + stats.non_lues + '</div><div class="kpi-label">Non lues</div></div>' +
          '<div class="kpi-card"><div class="kpi-value" style="color:var(--color-danger);">' + stats.critiques + '</div><div class="kpi-label">Critiques</div></div>' +
        '</div>';
    }).catch(function () {});

    /* Liste des alertes */
    authFetch(API_BASE + "/api/veille/medicament?limit=20").then(function (r) { return r.json(); }).then(function (data) {
      var container = document.getElementById("veille-med-list");
      var alertes = data.alertes || [];
      if (alertes.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-secondary);">Aucune alerte médicament. Cliquez sur "Actualiser les sources" pour scanner.</p>';
        return;
      }
      var html = '';
      alertes.forEach(function (a) {
        var impactClass = a.impact === "critique" ? "color:var(--color-danger);" : (a.impact === "important" ? "color:var(--color-warning);" : "");
        html += '<div style="padding:0.75rem 0;border-bottom:1px solid var(--color-border);">' +
          '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.25rem;">' +
            '<span class="badge badge-neutral" style="font-size:0.6875rem;">' + escapeHtml(a.source) + '</span>' +
            '<span class="badge badge-neutral" style="font-size:0.6875rem;">' + escapeHtml(a.categorie) + '</span>' +
            '<span style="font-size:0.75rem;font-weight:600;' + impactClass + '">' + escapeHtml(a.impact) + '</span>' +
          '</div>' +
          '<p style="margin:0;font-weight:500;">' + (a.url ? '<a href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener" style="color:var(--color-primary);text-decoration:none;">' + escapeHtml(a.titre) + '</a>' : escapeHtml(a.titre)) + '</p>' +
          (a.resume ? '<p style="margin:0.25rem 0 0;font-size:0.8125rem;color:var(--color-text-secondary);">' + escapeHtml(a.resume.substring(0, 200)) + '</p>' : '') +
        '</div>';
      });
      container.innerHTML = html;
    }).catch(function () {
      document.getElementById("veille-med-list").innerHTML = '<p style="color:var(--color-danger);">Erreur de chargement.</p>';
    });

    /* Bouton refresh */
    document.getElementById("veille-med-refresh").addEventListener("click", function () {
      this.disabled = true;
      this.textContent = "Scan en cours...";
      var btn = this;
      authFetch(API_BASE + "/api/veille/medicament/refresh", { method: "POST" })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          btn.textContent = data.total_new + " nouvelle(s) alerte(s)";
          setTimeout(function () { renderVeilleMedicament(); }, 1500);
        })
        .catch(function () {
          btn.textContent = "Erreur";
          btn.disabled = false;
        });
    });
  };

})();
