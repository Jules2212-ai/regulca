"""
RégulCA — Module Médicament API
Routes FastAPI pour CTD, variations, traduction et veille médicament.
Utilise un APIRouter inclus dans api_server.py via create_medicament_router(db).
"""

import json
import hashlib
import re
import urllib.request
import ssl
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

import claude_service
from variations_catalogue import get_catalogue

# ---------------------------------------------------------------------------
# Factory : crée le router avec accès à la base de données
# ---------------------------------------------------------------------------
def create_medicament_router(db):
    """Créer le router médicament avec injection de la base de données."""
    router = APIRouter()

    # ===================================================================
    # CTD DOSSIERS — CRUD
    # ===================================================================

    @router.post("/api/ctd/dossiers", status_code=201)
    def create_ctd_dossier(body: dict, request: Request):
        """Créer un nouveau dossier CTD."""
        dossier_id = body.get("id")
        nom = body.get("nom_medicament")
        dci = body.get("dci")
        type_proc = body.get("type_procedure")

        if not all([dossier_id, nom, dci, type_proc]):
            return JSONResponse(status_code=400, content={
                "error": "Champs requis : id, nom_medicament, dci, type_procedure"
            })

        now = datetime.now().isoformat()
        data_json = json.dumps(body, ensure_ascii=False)
        # Extraire l'utilisateur du token (mis par le middleware auth)
        from api_server import get_current_user
        user = get_current_user(request)
        created_by = user["sub"] if user else "inconnu"

        try:
            db.execute(
                """INSERT INTO ctd_dossiers (id, nom_medicament, dci, type_procedure, statut, data,
                   date_creation, date_modification, created_by)
                   VALUES (?, ?, ?, ?, 'brouillon', ?, ?, ?, ?)""",
                (dossier_id, nom, dci, type_proc, data_json, now, now, created_by)
            )
            db.commit()
        except Exception as e:
            if "UNIQUE" in str(e).upper() or "duplicate" in str(e).lower():
                return JSONResponse(status_code=409, content={"error": "Dossier CTD déjà existant", "id": dossier_id})
            raise
        return {"ok": True, "id": dossier_id}

    @router.get("/api/ctd/dossiers")
    def list_ctd_dossiers():
        """Lister tous les dossiers CTD."""
        rows = db.execute(
            "SELECT id, nom_medicament, dci, type_procedure, statut, date_creation, date_modification, created_by "
            "FROM ctd_dossiers ORDER BY date_modification DESC"
        ).fetchall()
        return {"dossiers": [dict(r) for r in rows]}

    @router.get("/api/ctd/dossiers/{dossier_id}")
    def get_ctd_dossier(dossier_id: str):
        """Récupérer un dossier CTD avec ses sections."""
        row = db.execute("SELECT * FROM ctd_dossiers WHERE id = ?", (dossier_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Dossier CTD non trouvé", "id": dossier_id})
        dossier = dict(row)
        dossier["data"] = json.loads(dossier["data"])
        # Récupérer les sections associées
        sections = db.execute(
            "SELECT * FROM ctd_sections WHERE dossier_id = ? ORDER BY module, section",
            (dossier_id,)
        ).fetchall()
        dossier["sections"] = [dict(s) for s in sections]
        return {"dossier": dossier}

    @router.put("/api/ctd/dossiers/{dossier_id}")
    def update_ctd_dossier(dossier_id: str, body: dict):
        """Mettre à jour un dossier CTD."""
        row = db.execute("SELECT id FROM ctd_dossiers WHERE id = ?", (dossier_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Dossier CTD non trouvé", "id": dossier_id})
        now = datetime.now().isoformat()
        nom = body.get("nom_medicament")
        dci = body.get("dci")
        type_proc = body.get("type_procedure")
        statut = body.get("statut")
        data_json = json.dumps(body, ensure_ascii=False)
        db.execute(
            """UPDATE ctd_dossiers SET nom_medicament = COALESCE(?, nom_medicament),
               dci = COALESCE(?, dci), type_procedure = COALESCE(?, type_procedure),
               statut = COALESCE(?, statut), data = ?, date_modification = ?
               WHERE id = ?""",
            (nom, dci, type_proc, statut, data_json, now, dossier_id)
        )
        db.commit()
        return {"ok": True, "id": dossier_id}

    @router.delete("/api/ctd/dossiers/{dossier_id}")
    def delete_ctd_dossier(dossier_id: str):
        """Supprimer un dossier CTD et ses sections associées."""
        row = db.execute("SELECT id FROM ctd_dossiers WHERE id = ?", (dossier_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Dossier CTD non trouvé", "id": dossier_id})
        # Supprimer les sections d'abord (FK CASCADE ne fonctionne pas toujours en SQLite)
        db.execute("DELETE FROM ctd_sections WHERE dossier_id = ?", (dossier_id,))
        db.execute("DELETE FROM ctd_dossiers WHERE id = ?", (dossier_id,))
        db.commit()
        return {"ok": True, "id": dossier_id}

    # ===================================================================
    # CTD — GÉNÉRATION IA
    # ===================================================================

    @router.post("/api/ctd/dossiers/{dossier_id}/generate")
    def generate_ctd_section(dossier_id: str, body: dict, request: Request):
        """Générer une section CTD via l'IA Claude."""
        if not claude_service.is_available():
            return JSONResponse(status_code=503, content={
                "error": "API Claude non configurée. Ajoutez ANTHROPIC_API_KEY dans .env."
            })

        row = db.execute("SELECT data FROM ctd_dossiers WHERE id = ?", (dossier_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Dossier CTD non trouvé"})

        module_num = body.get("module")
        section = body.get("section")
        titre = body.get("titre", f"Section {section}")
        language = body.get("language", "fr")

        if not module_num or not section:
            return JSONResponse(status_code=400, content={"error": "Champs requis : module, section"})

        dossier_data = json.loads(row["data"])

        try:
            result = claude_service.generate_ctd_section(module_num, section, dossier_data, language)
        except RuntimeError as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

        # Sauvegarder la section générée
        now = datetime.now().isoformat()
        from api_server import get_current_user
        user = get_current_user(request)
        created_by = user["sub"] if user else "inconnu"

        # Vérifier si la section existe déjà
        existing = db.execute(
            "SELECT id FROM ctd_sections WHERE dossier_id = ? AND module = ? AND section = ?",
            (dossier_id, module_num, section)
        ).fetchone()

        if existing:
            db.execute(
                """UPDATE ctd_sections SET contenu = ?, statut = 'genere', genere_par_ia = 1,
                   date_generation = ? WHERE id = ?""",
                (result["content"], now, existing["id"])
            )
        else:
            db.execute(
                """INSERT INTO ctd_sections (dossier_id, module, section, titre, contenu, statut,
                   genere_par_ia, date_generation)
                   VALUES (?, ?, ?, ?, ?, 'genere', 1, ?)""",
                (dossier_id, module_num, section, titre, result["content"], now)
            )
        db.commit()

        return {
            "ok": True,
            "content": result["content"],
            "model": result["model"],
            "usage": result.get("usage"),
        }

    # ===================================================================
    # VARIATIONS — CRUD + CLASSIFICATION IA
    # ===================================================================

    @router.get("/api/variations/catalogue")
    def get_variations_catalogue():
        """Retourner le catalogue complet des variations classifiées."""
        return {"catalogue": get_catalogue()}

    @router.post("/api/variations/classify")
    def classify_variation(body: dict):
        """Classifier une variation à partir d'une description libre (IA)."""
        if not claude_service.is_available():
            return JSONResponse(status_code=503, content={
                "error": "API Claude non configurée. Ajoutez ANTHROPIC_API_KEY dans .env."
            })

        description = body.get("description", "").strip()
        if not description:
            return JSONResponse(status_code=400, content={"error": "Champ requis : description"})

        try:
            result = claude_service.classify_variation(description)
        except RuntimeError as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

        return {"classification": result}

    @router.post("/api/variations/dossiers", status_code=201)
    def create_variation(body: dict, request: Request):
        """Créer un dossier de variation."""
        variation_id = body.get("id")
        categorie = body.get("categorie")
        type_var = body.get("type_variation")
        description = body.get("description")

        if not all([variation_id, categorie, type_var, description]):
            return JSONResponse(status_code=400, content={
                "error": "Champs requis : id, categorie, type_variation, description"
            })

        now = datetime.now().isoformat()
        data_json = json.dumps(body, ensure_ascii=False)
        from api_server import get_current_user
        user = get_current_user(request)
        created_by = user["sub"] if user else "inconnu"

        try:
            db.execute(
                """INSERT INTO variations (id, dossier_ctd_id, categorie, sous_categorie,
                   type_variation, description, statut, data, date_creation, date_modification, created_by)
                   VALUES (?, ?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?)""",
                (variation_id, body.get("dossier_ctd_id"), categorie,
                 body.get("sous_categorie"), type_var, description, data_json, now, now, created_by)
            )
            db.commit()
        except Exception as e:
            if "UNIQUE" in str(e).upper() or "duplicate" in str(e).lower():
                return JSONResponse(status_code=409, content={"error": "Variation déjà existante", "id": variation_id})
            raise
        return {"ok": True, "id": variation_id}

    @router.get("/api/variations/dossiers")
    def list_variations():
        """Lister tous les dossiers de variation."""
        rows = db.execute(
            "SELECT id, dossier_ctd_id, categorie, sous_categorie, type_variation, "
            "description, statut, date_creation, date_modification, created_by "
            "FROM variations ORDER BY date_modification DESC"
        ).fetchall()
        return {"variations": [dict(r) for r in rows]}

    @router.get("/api/variations/dossiers/{variation_id}")
    def get_variation(variation_id: str):
        """Récupérer un dossier de variation."""
        row = db.execute("SELECT * FROM variations WHERE id = ?", (variation_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Variation non trouvée", "id": variation_id})
        result = dict(row)
        result["data"] = json.loads(result["data"])
        return {"variation": result}

    @router.put("/api/variations/dossiers/{variation_id}")
    def update_variation(variation_id: str, body: dict):
        """Mettre à jour un dossier de variation."""
        row = db.execute("SELECT id FROM variations WHERE id = ?", (variation_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Variation non trouvée", "id": variation_id})
        now = datetime.now().isoformat()
        data_json = json.dumps(body, ensure_ascii=False)
        db.execute(
            """UPDATE variations SET categorie = COALESCE(?, categorie),
               sous_categorie = COALESCE(?, sous_categorie),
               type_variation = COALESCE(?, type_variation),
               description = COALESCE(?, description),
               classification_ia = COALESCE(?, classification_ia),
               documents_requis = COALESCE(?, documents_requis),
               cover_letter = COALESCE(?, cover_letter),
               statut = COALESCE(?, statut),
               data = ?, date_modification = ?
               WHERE id = ?""",
            (body.get("categorie"), body.get("sous_categorie"),
             body.get("type_variation"), body.get("description"),
             body.get("classification_ia"), body.get("documents_requis"),
             body.get("cover_letter"), body.get("statut"),
             data_json, now, variation_id)
        )
        db.commit()
        return {"ok": True, "id": variation_id}

    @router.post("/api/variations/dossiers/{variation_id}/generate")
    def generate_variation_docs(variation_id: str):
        """Générer les documents de variation (cover letter, etc.) via IA."""
        if not claude_service.is_available():
            return JSONResponse(status_code=503, content={
                "error": "API Claude non configurée. Ajoutez ANTHROPIC_API_KEY dans .env."
            })

        row = db.execute("SELECT * FROM variations WHERE id = ?", (variation_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Variation non trouvée"})

        description = row["description"]
        try:
            result = claude_service.classify_variation(description)
        except RuntimeError as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

        # Mettre à jour la variation avec les résultats IA
        now = datetime.now().isoformat()
        docs_requis = json.dumps(result.get("documents_requis", []), ensure_ascii=False)
        cover = result.get("cover_letter", "")
        classif = json.dumps(result, ensure_ascii=False)

        db.execute(
            """UPDATE variations SET classification_ia = ?, documents_requis = ?,
               cover_letter = ?, date_modification = ? WHERE id = ?""",
            (classif, docs_requis, cover, now, variation_id)
        )
        db.commit()
        return {"ok": True, "classification": result}

    # ===================================================================
    # TRADUCTION FR↔EN
    # ===================================================================

    @router.post("/api/translate/text")
    def translate_text(body: dict, request: Request):
        """Traduire du texte avec terminologie pharmaceutique."""
        text = body.get("text", "").strip()
        if not text:
            return JSONResponse(status_code=400, content={"error": "Champ requis : text"})

        if not claude_service.is_available():
            return JSONResponse(status_code=503, content={
                "error": "API Claude non configurée. Ajoutez ANTHROPIC_API_KEY dans .env."
            })

        source_lang = body.get("source_lang", "fr")
        target_lang = body.get("target_lang", "en")
        pharma_mode = body.get("pharma_mode", True)

        try:
            result = claude_service.translate_text(text, source_lang, target_lang, pharma_mode)
        except RuntimeError as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

        # Sauvegarder en historique
        now = datetime.now().isoformat()
        from api_server import get_current_user
        user = get_current_user(request)
        created_by = user["sub"] if user else "inconnu"

        db.execute(
            """INSERT INTO traductions (texte_source, texte_traduit, langue_source, langue_cible,
               type, date_creation, created_by) VALUES (?, ?, ?, ?, 'text', ?, ?)""",
            (text, result.get("translated_text", ""), source_lang, target_lang, now, created_by)
        )
        db.commit()

        return {"translation": result}

    @router.get("/api/translate/glossary")
    def get_glossary():
        """Récupérer le glossaire pharmaceutique."""
        rows = db.execute(
            "SELECT id, terme_fr, terme_en, contexte, valide FROM glossaire ORDER BY terme_fr"
        ).fetchall()
        return {"glossaire": [dict(r) for r in rows]}

    @router.post("/api/translate/glossary", status_code=201)
    def add_glossary_term(body: dict, request: Request):
        """Ajouter un terme au glossaire."""
        terme_fr = body.get("terme_fr", "").strip()
        terme_en = body.get("terme_en", "").strip()
        if not terme_fr or not terme_en:
            return JSONResponse(status_code=400, content={"error": "Champs requis : terme_fr, terme_en"})

        now = datetime.now().isoformat()
        from api_server import get_current_user
        user = get_current_user(request)
        valide_par = user["sub"] if user else None

        db.execute(
            """INSERT INTO glossaire (terme_fr, terme_en, contexte, valide, valide_par, date_creation)
               VALUES (?, ?, ?, 0, ?, ?)""",
            (terme_fr, terme_en, body.get("contexte"), valide_par, now)
        )
        db.commit()
        return {"ok": True}

    @router.put("/api/translate/glossary/{term_id}")
    def update_glossary_term(term_id: int, body: dict):
        """Modifier un terme du glossaire."""
        row = db.execute("SELECT id FROM glossaire WHERE id = ?", (term_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Terme non trouvé"})
        db.execute(
            """UPDATE glossaire SET terme_fr = COALESCE(?, terme_fr),
               terme_en = COALESCE(?, terme_en),
               contexte = COALESCE(?, contexte),
               valide = COALESCE(?, valide)
               WHERE id = ?""",
            (body.get("terme_fr"), body.get("terme_en"), body.get("contexte"),
             body.get("valide"), term_id)
        )
        db.commit()
        return {"ok": True}

    @router.delete("/api/translate/glossary/{term_id}")
    def delete_glossary_term(term_id: int):
        """Supprimer un terme du glossaire."""
        row = db.execute("SELECT id FROM glossaire WHERE id = ?", (term_id,)).fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Terme non trouvé"})
        db.execute("DELETE FROM glossaire WHERE id = ?", (term_id,))
        db.commit()
        return {"ok": True}

    # ===================================================================
    # VEILLE RÉGLEMENTAIRE MÉDICAMENT
    # ===================================================================

    KEYWORDS_MEDICAMENT = [
        "autorisation de mise sur le marché", "AMM",
        "variation", "modification d'AMM",
        "résumé des caractéristiques du produit", "RCP", "SmPC",
        "pharmacovigilance", "effet indésirable", "PSUR",
        "rappel de lot", "retrait de lot", "suspension",
        "rupture d'approvisionnement", "rupture de stock",
        "bonnes pratiques de fabrication", "BPF", "GMP",
        "inspection", "non-conformité",
        "CHMP", "PRAC", "CMDh",
        "ICH guideline", "ICH Q", "ICH E", "ICH M", "ICH S",
        "Pharmacopée européenne", "Ph. Eur.", "monographie",
        "CEP", "certificat de conformité",
        "bioéquivalence", "biodisponibilité",
        "plan de gestion des risques", "PGR", "RMP",
        "DHPC", "Dear Healthcare Professional",
        "Commission de la Transparence", "SMR", "ASMR",
        "2001/83/CE", "726/2004", "1234/2008",
        "médicament", "spécialité pharmaceutique",
    ]

    SSL_CTX = ssl.create_default_context()
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

    def _fetch_url(url, timeout=15):
        """Fetch URL en toute sécurité."""
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "RégulCA-Veille/2.0 (regulatory-monitoring)"
            })
            with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception:
            return None

    def _is_relevant_med(text):
        """Vérifier si un texte contient des mots-clés médicament."""
        if not text:
            return False
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in KEYWORDS_MEDICAMENT)

    def _determine_impact_med(titre, resume):
        """Déterminer l'impact d'une alerte médicament."""
        combined = (titre + " " + (resume or "")).lower()
        if any(w in combined for w in ["retrait", "rappel", "suspension", "alerte", "danger", "dhpc", "signal"]):
            return "critique"
        if any(w in combined for w in ["modification", "guideline", "pharmacopée", "bpf", "gmp", "variation"]):
            return "important"
        return "info"

    def _determine_categorie_med(titre, resume):
        """Catégoriser une alerte médicament."""
        combined = (titre + " " + (resume or "")).lower()
        if any(w in combined for w in ["retrait", "rappel", "alerte", "signal", "dhpc"]):
            return "Sécurité"
        if any(w in combined for w in ["pharmacovigilance", "psur", "effet indésirable", "eig"]):
            return "Pharmacovigilance"
        if any(w in combined for w in ["bpf", "gmp", "inspection", "non-conformité", "certificat"]):
            return "BPF/Inspections"
        if any(w in combined for w in ["pharmacopée", "monographie", "ich q", "qualité", "cep"]):
            return "Qualité"
        if any(w in combined for w in ["smr", "asmr", "efficacité", "clinique"]):
            return "Efficacité"
        if any(w in combined for w in ["rupture", "tension", "approvisionnement"]):
            return "Ruptures"
        if any(w in combined for w in ["prix", "remboursement", "ceps"]):
            return "Prix/Remboursement"
        return "Réglementaire"

    def _hash_alerte(source, titre, url):
        """Hash unique pour dédoublonnage."""
        raw = f"{source}|{titre}|{url or ''}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def _insert_alerte_med(source, titre, resume, url, date_pub):
        """Insérer une alerte médicament si non dupliquée."""
        h = _hash_alerte(source, titre, url)
        existing = db.execute("SELECT id FROM alertes WHERE hash = ?", (h,)).fetchone()
        if existing:
            return False
        categorie = _determine_categorie_med(titre, resume)
        impact = _determine_impact_med(titre, resume)
        db.execute(
            """INSERT INTO alertes (hash, source, categorie, titre, resume, url,
               date_publication, date_detection, impact, module)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'medicament')""",
            (h, source, categorie, titre, resume, url, date_pub, datetime.now().isoformat(), impact)
        )
        return True

    def _scan_ema(db_ref):
        """Scanner le flux RSS de l'EMA."""
        count = 0
        rss_url = "https://www.ema.europa.eu/en/news-events/whats-new?f%5B0%5D=ema_search_categories%3A83&format=rss"
        content = _fetch_url(rss_url, timeout=20)
        if content:
            try:
                root = ET.fromstring(content)
                for item in root.findall(".//item"):
                    title = (item.findtext("title") or "").strip()
                    link = (item.findtext("link") or "").strip()
                    desc = (item.findtext("description") or "").strip()
                    pub = item.findtext("pubDate") or datetime.now().isoformat()
                    if _is_relevant_med(title + " " + desc):
                        if _insert_alerte_med("EMA", title, desc[:500], link, pub):
                            count += 1
            except ET.ParseError:
                pass
        return count

    def _scan_ansm(db_ref):
        """Scanner le site de l'ANSM pour les alertes médicament."""
        count = 0
        urls = [
            "https://ansm.sante.fr/informations-de-securite",
            "https://ansm.sante.fr/actualites",
        ]
        for base_url in urls:
            content = _fetch_url(base_url, timeout=15)
            if content:
                matches = re.findall(r'<a[^>]*href="(/[^"]+)"[^>]*>([^<]{10,})</a>', content)
                for href, title in matches[:15]:
                    if _is_relevant_med(title):
                        full_url = "https://ansm.sante.fr" + href if href.startswith("/") else href
                        if _insert_alerte_med("ANSM", title.strip(), None, full_url,
                                              datetime.now().strftime("%Y-%m-%d")):
                            count += 1
        return count

    def _scan_has(db_ref):
        """Scanner la HAS pour les avis de la Commission de la Transparence."""
        count = 0
        has_url = "https://www.has-sante.fr/jcms/fc_2875171/fr/les-medicaments"
        content = _fetch_url(has_url, timeout=15)
        if content:
            matches = re.findall(r'<a[^>]*href="(/jcms/[^"]+)"[^>]*>([^<]{10,})</a>', content)
            for href, title in matches[:15]:
                if _is_relevant_med(title):
                    full_url = "https://www.has-sante.fr" + href
                    if _insert_alerte_med("HAS", title.strip(), None, full_url,
                                          datetime.now().strftime("%Y-%m-%d")):
                        count += 1
        return count

    MED_SCANNERS = {
        "EMA": _scan_ema,
        "ANSM": _scan_ansm,
        "HAS": _scan_has,
    }

    @router.get("/api/veille/medicament")
    def get_veille_medicament(
        categorie: str = Query(None),
        impact: str = Query(None),
        source: str = Query(None),
        limit: int = Query(50),
        offset: int = Query(0),
        q: str = Query(None)
    ):
        """Alertes de veille réglementaire médicament."""
        query = "SELECT * FROM alertes WHERE module = 'medicament'"
        params = []
        if categorie:
            query += " AND categorie = ?"
            params.append(categorie)
        if impact:
            query += " AND impact = ?"
            params.append(impact)
        if source:
            query += " AND source = ?"
            params.append(source)
        if q:
            query += " AND (titre LIKE ? OR resume LIKE ?)"
            params.extend([f"%{q}%", f"%{q}%"])

        count_query = query.replace("SELECT *", "SELECT COUNT(*) as cnt")
        total = db.execute(count_query, params).fetchone()["cnt"]

        query += " ORDER BY date_detection DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = db.execute(query, params).fetchall()

        return {"alertes": [dict(r) for r in rows], "total": total, "limit": limit, "offset": offset}

    @router.get("/api/veille/medicament/stats")
    def get_veille_medicament_stats():
        """Statistiques de veille médicament."""
        total = db.execute("SELECT COUNT(*) as cnt FROM alertes WHERE module = 'medicament'").fetchone()["cnt"]
        non_lues = db.execute("SELECT COUNT(*) as cnt FROM alertes WHERE module = 'medicament' AND lu = 0").fetchone()["cnt"]
        critiques = db.execute("SELECT COUNT(*) as cnt FROM alertes WHERE module = 'medicament' AND impact = 'critique'").fetchone()["cnt"]

        cats = db.execute(
            "SELECT categorie, COUNT(*) as cnt FROM alertes WHERE module = 'medicament' GROUP BY categorie ORDER BY cnt DESC"
        ).fetchall()

        srcs = db.execute(
            "SELECT source, COUNT(*) as cnt FROM alertes WHERE module = 'medicament' GROUP BY source ORDER BY cnt DESC"
        ).fetchall()

        return {
            "total_alertes": total,
            "non_lues": non_lues,
            "critiques": critiques,
            "by_category": [dict(r) for r in cats],
            "by_source": [dict(r) for r in srcs],
        }

    @router.post("/api/veille/medicament/refresh")
    def refresh_veille_medicament():
        """Déclencher un scan immédiat des sources médicament."""
        results = {}
        total_new = 0
        for source_name, scanner_fn in MED_SCANNERS.items():
            try:
                count = scanner_fn(db)
                results[source_name] = {"status": "ok", "new_alerts": count}
                total_new += count
            except Exception as e:
                results[source_name] = {"status": "error", "message": str(e)}
        db.commit()
        return {"total_new": total_new, "sources": results, "scan_date": datetime.now().isoformat()}

    return router
