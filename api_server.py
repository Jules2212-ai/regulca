#!/usr/bin/env python3
"""
RégulCA — Backend API Server
Veille réglementaire automatisée pour compléments alimentaires en France.

Endpoints:
  GET  /api/veille           — Toutes les alertes réglementaires
  GET  /api/veille/stats     — Statistiques de veille
  GET  /api/veille/sources   — Sources surveillées et leur état
  POST /api/veille/refresh   — Déclencher un scan immédiat
  GET  /api/veille/search    — Rechercher dans les alertes
  GET  /api/health           — Healthcheck
"""

import sqlite3
import json
import hashlib
import re
import urllib.request
import urllib.error
import ssl
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
import os
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "veille.db")

def get_db():
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    return db

def init_db(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS alertes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT UNIQUE NOT NULL,
            source TEXT NOT NULL,
            categorie TEXT NOT NULL,
            titre TEXT NOT NULL,
            resume TEXT,
            url TEXT,
            date_publication TEXT,
            date_detection TEXT NOT NULL,
            impact TEXT DEFAULT 'info',
            textes_concernes TEXT,
            lu INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nom TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            url TEXT NOT NULL,
            derniere_verification TEXT,
            statut TEXT DEFAULT 'actif',
            nb_alertes INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS scan_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_scan TEXT NOT NULL,
            source TEXT NOT NULL,
            nb_nouvelles INTEGER DEFAULT 0,
            statut TEXT DEFAULT 'ok',
            message TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_alertes_date ON alertes(date_detection DESC);
        CREATE INDEX IF NOT EXISTS idx_alertes_source ON alertes(source);
        CREATE INDEX IF NOT EXISTS idx_alertes_categorie ON alertes(categorie);

        CREATE TABLE IF NOT EXISTS dossiers (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            date_creation TEXT NOT NULL,
            date_modification TEXT NOT NULL
        );
    """)

    # Seed sources if empty
    existing = db.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
    if existing == 0:
        sources = [
            ("Légifrance", "api", "https://www.legifrance.gouv.fr/", "Textes législatifs et réglementaires français"),
            ("EUR-Lex / Cellar", "rss", "https://eur-lex.europa.eu/", "Règlements et directives européens"),
            ("ANSES", "web", "https://www.anses.fr/", "Avis et évaluations de sécurité"),
            ("DGAL / Compl'Alim", "web", "https://agriculture.gouv.fr/", "Déclarations et contrôles compléments alimentaires"),
            ("DGCCRF", "web", "https://www.economie.gouv.fr/dgccrf/", "Contrôles et alertes consommation"),
            ("EFSA", "rss", "https://www.efsa.europa.eu/", "Avis scientifiques européens"),
            ("Journal Officiel (JORF)", "api", "https://www.legifrance.gouv.fr/jorf/", "Publications du Journal Officiel"),
            ("Data.gouv.fr", "api", "https://www.data.gouv.fr/", "Données ouvertes - déclarations CA"),
        ]
        for nom, typ, url, desc in sources:
            db.execute(
                "INSERT OR IGNORE INTO sources (nom, type, url, nb_alertes) VALUES (?, ?, ?, 0)",
                (nom, typ, url)
            )
    db.commit()

db = get_db()
init_db(db)

# ---------------------------------------------------------------------------
# Regulatory scanning logic
# ---------------------------------------------------------------------------
KEYWORDS_CA = [
    "complément alimentaire", "compléments alimentaires",
    "food supplement", "dietary supplement",
    "nutriment", "vitamine", "minéral",
    "allégation santé", "allégation nutritionnelle",
    "étiquetage", "INCO", "1169/2011",
    "2002/46", "1924/2006", "432/2012",
    "2006-352", "plantes autorisées",
    "novel food", "nouveaux aliments",
    "dose maximale", "DGAL", "DGCCRF",
    "Compl'Alim", "Teleicare",
    "nutraceutique", "botanique",
]

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def fetch_url_safe(url, timeout=15):
    """Fetch URL content safely, returning text or None."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "RégulCA-Veille/1.0 (regulatory-monitoring)"
        })
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None

def hash_alerte(source, titre, url):
    """Create unique hash for deduplication."""
    raw = f"{source}|{titre}|{url or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

def is_relevant(text):
    """Check if text contains food supplement regulatory keywords."""
    if not text:
        return False
    text_lower = text.lower()
    score = sum(1 for kw in KEYWORDS_CA if kw.lower() in text_lower)
    return score >= 1

def determine_impact(titre, resume):
    """Determine impact level: critique, important, info."""
    combined = (titre + " " + (resume or "")).lower()
    if any(w in combined for w in ["retrait", "rappel", "interdiction", "suspension", "danger", "alerte sanitaire"]):
        return "critique"
    if any(w in combined for w in ["modification", "nouveau règlement", "mise à jour", "arrêté", "décret", "obligation", "dose maximale"]):
        return "important"
    return "info"

def determine_categorie(titre, resume):
    """Categorize the alert."""
    combined = (titre + " " + (resume or "")).lower()
    if any(w in combined for w in ["allégation", "1924/2006", "432/2012", "claim"]):
        return "Allégations"
    if any(w in combined for w in ["étiquetage", "inco", "1169/2011", "étiquette"]):
        return "Étiquetage"
    if any(w in combined for w in ["plante", "botanique", "24 juin 2014"]):
        return "Plantes"
    if any(w in combined for w in ["vitamine", "minéral", "nutriment", "9 mai 2006"]):
        return "Nutriments"
    if any(w in combined for w in ["novel food", "nouveaux aliments", "2015/2283"]):
        return "Novel Food"
    if any(w in combined for w in ["retrait", "rappel", "alerte", "danger"]):
        return "Alertes sanitaires"
    if any(w in combined for w in ["déclaration", "compl'alim", "teleicare", "dgal"]):
        return "Déclarations"
    return "Général"

def determine_textes(titre, resume):
    """Identify which regulatory texts are concerned."""
    combined = (titre + " " + (resume or "")).lower()
    textes = []
    mapping = {
        "2006-352": "Décret 2006-352",
        "9 mai 2006": "Arrêté 9 mai 2006",
        "24 juin 2014": "Arrêté 24 juin 2014",
        "2002/46": "Directive 2002/46/CE",
        "1169/2011": "Règlement INCO 1169/2011",
        "1924/2006": "Règlement 1924/2006",
        "432/2012": "Règlement 432/2012",
        "2015/2283": "Règlement Novel Food 2015/2283",
    }
    for key, val in mapping.items():
        if key in combined:
            textes.append(val)
    return ", ".join(textes) if textes else None

def insert_alerte(db, source, titre, resume, url, date_pub, categorie=None, impact=None, textes=None):
    """Insert an alert if not duplicate. Returns True if new."""
    h = hash_alerte(source, titre, url)
    existing = db.execute("SELECT id FROM alertes WHERE hash = ?", (h,)).fetchone()
    if existing:
        return False
    if categorie is None:
        categorie = determine_categorie(titre, resume)
    if impact is None:
        impact = determine_impact(titre, resume)
    if textes is None:
        textes = determine_textes(titre, resume)

    db.execute("""
        INSERT INTO alertes (hash, source, categorie, titre, resume, url, date_publication, date_detection, impact, textes_concernes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (h, source, categorie, titre, resume, url, date_pub, datetime.now().isoformat(), impact, textes))
    return True

# ---- Scanners per source ----

def scan_eurlex_rss(db):
    """Scan EUR-Lex Cellar RSS for recent regulatory updates."""
    count = 0
    now = datetime.now()
    start = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    # Attempt fetching the EU Publications RSS feed for recent legislation
    feed_url = f"https://publications.europa.eu/webapi/notification/ingestion?startDate={start}&type=UPDATE&wemiClasses=work"
    content = fetch_url_safe(feed_url, timeout=20)

    # Also try EUR-Lex search page for food supplement related updates
    eurlex_search = "https://eur-lex.europa.eu/search.html?type=quick&text=complement+alimentaire&lang=fr"

    if content:
        try:
            root = ET.fromstring(content)
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            for entry in root.findall(".//item", ns) or root.findall(".//item"):
                title_el = entry.find("title")
                link_el = entry.find("link")
                desc_el = entry.find("description")
                pub_el = entry.find("pubDate")

                title = title_el.text if title_el is not None else ""
                link = link_el.text if link_el is not None else ""
                desc = desc_el.text if desc_el is not None else ""
                pub = pub_el.text if pub_el is not None else now.isoformat()

                if is_relevant(title + " " + desc):
                    if insert_alerte(db, "EUR-Lex / Cellar", title, desc, link, pub):
                        count += 1
        except ET.ParseError:
            pass

    return count

def scan_legifrance(db):
    """Check Légifrance for recent modifications to key texts."""
    count = 0
    # Key texts to monitor — check their modification pages
    key_texts = [
        {
            "titre": "Décret 2006-352 relatif aux compléments alimentaires",
            "url": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000638341/",
            "id": "JORFTEXT000000638341"
        },
        {
            "titre": "Arrêté du 9 mai 2006 — nutriments",
            "url": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000454178/",
            "id": "JORFTEXT000000454178"
        },
        {
            "titre": "Arrêté du 24 juin 2014 — plantes autorisées",
            "url": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000029254516/",
            "id": "JORFTEXT000029254516"
        },
    ]

    for text in key_texts:
        content = fetch_url_safe(text["url"], timeout=15)
        if content:
            # Look for modification dates in the page
            modifications = re.findall(r'Modifié par.*?(?:Décret|Arrêté|Loi|Ordonnance).*?n°\s*(\d{4}-\d+).*?du\s+(\d{1,2}\s+\w+\s+\d{4})', content)
            for mod_num, mod_date in modifications[-3:]:  # Last 3 modifications
                titre = f"Modification du {text['titre']} — Texte n°{mod_num} du {mod_date}"
                if insert_alerte(db, "Légifrance", titre,
                               f"Le texte {text['titre']} a été modifié par le texte n°{mod_num}.",
                               text["url"], mod_date):
                    count += 1

    return count

def scan_jorf(db):
    """Scan Journal Officiel for recent food supplement texts."""
    count = 0
    jorf_url = "https://www.legifrance.gouv.fr/jorf/jo"
    content = fetch_url_safe(jorf_url, timeout=15)
    # The JORF page is complex, we extract any mention of food supplement related texts
    if content:
        # Look for relevant recent publications
        matches = re.findall(r'<a[^>]*href="(/jorf/id/[^"]+)"[^>]*>([^<]+)</a>', content)
        for href, title in matches[:20]:
            if is_relevant(title):
                full_url = "https://www.legifrance.gouv.fr" + href
                if insert_alerte(db, "Journal Officiel (JORF)", title.strip(), None, full_url,
                               datetime.now().strftime("%Y-%m-%d")):
                    count += 1
    return count

def scan_anses(db):
    """Scan ANSES for recent opinions on food supplements."""
    count = 0
    anses_url = "https://www.anses.fr/fr/content/les-compl%C3%A9ments-alimentaires"
    content = fetch_url_safe(anses_url, timeout=15)
    if content:
        # Extract article links from ANSES page
        matches = re.findall(r'<a[^>]*href="(/fr/content/[^"]+)"[^>]*>([^<]+)</a>', content)
        for href, title in matches:
            if is_relevant(title) or "complément" in title.lower():
                full_url = "https://www.anses.fr" + href
                if insert_alerte(db, "ANSES", title.strip(),
                               "Nouvel avis ou publication de l'ANSES concernant les compléments alimentaires.",
                               full_url, datetime.now().strftime("%Y-%m-%d")):
                    count += 1
    return count

def scan_dgccrf(db):
    """Scan DGCCRF for food supplement alerts and updates."""
    count = 0
    dgccrf_url = "https://www.economie.gouv.fr/dgccrf/complements-alimentaires"
    content = fetch_url_safe(dgccrf_url, timeout=15)
    if content:
        matches = re.findall(r'<a[^>]*href="(/[^"]+)"[^>]*>([^<]{10,})</a>', content)
        for href, title in matches[:20]:
            if is_relevant(title):
                full_url = "https://www.economie.gouv.fr" + href if href.startswith("/") else href
                if insert_alerte(db, "DGCCRF", title.strip(), None, full_url,
                               datetime.now().strftime("%Y-%m-%d")):
                    count += 1
    return count

def scan_efsa(db):
    """Scan EFSA RSS for food supplement related opinions."""
    count = 0
    efsa_rss = "https://www.efsa.europa.eu/en/rss/output"
    content = fetch_url_safe(efsa_rss, timeout=15)
    if content:
        try:
            root = ET.fromstring(content)
            for item in root.findall(".//item"):
                title_el = item.find("title")
                link_el = item.find("link")
                desc_el = item.find("description")
                pub_el = item.find("pubDate")
                title = title_el.text if title_el is not None else ""
                link = link_el.text if link_el is not None else ""
                desc = desc_el.text if desc_el is not None else ""
                pub = pub_el.text if pub_el is not None else ""
                if is_relevant(title + " " + desc):
                    if insert_alerte(db, "EFSA", title, desc[:500], link, pub):
                        count += 1
        except ET.ParseError:
            pass
    return count

def scan_data_gouv(db):
    """Check data.gouv.fr food supplement dataset for updates."""
    count = 0
    api_url = "https://www.data.gouv.fr/api/1/datasets/declarations-de-complements-alimentaires/"
    content = fetch_url_safe(api_url, timeout=15)
    if content:
        try:
            data = json.loads(content)
            last_modified = data.get("last_modified", "")
            title = data.get("title", "Déclarations de compléments alimentaires")
            desc = data.get("description", "")[:300]
            nb_resources = len(data.get("resources", []))

            titre = f"Mise à jour du jeu de données : {title} ({nb_resources} ressources)"
            if insert_alerte(db, "Data.gouv.fr", titre, desc,
                           "https://www.data.gouv.fr/datasets/declarations-de-complements-alimentaires",
                           last_modified):
                count += 1
        except json.JSONDecodeError:
            pass
    return count


SCANNERS = {
    "EUR-Lex / Cellar": scan_eurlex_rss,
    "Légifrance": scan_legifrance,
    "Journal Officiel (JORF)": scan_jorf,
    "ANSES": scan_anses,
    "DGCCRF": scan_dgccrf,
    "EFSA": scan_efsa,
    "Data.gouv.fr": scan_data_gouv,
}

def run_full_scan(db):
    """Run all scanners and return results."""
    results = {}
    total_new = 0
    for source_name, scanner_fn in SCANNERS.items():
        try:
            count = scanner_fn(db)
            results[source_name] = {"status": "ok", "new_alerts": count}
            total_new += count
            db.execute("""
                INSERT INTO scan_log (date_scan, source, nb_nouvelles, statut, message)
                VALUES (?, ?, ?, 'ok', NULL)
            """, (datetime.now().isoformat(), source_name, count))
            db.execute("""
                UPDATE sources SET derniere_verification = ?, nb_alertes = nb_alertes + ?
                WHERE nom = ?
            """, (datetime.now().isoformat(), count, source_name))
        except Exception as e:
            results[source_name] = {"status": "error", "message": str(e)}
            db.execute("""
                INSERT INTO scan_log (date_scan, source, nb_nouvelles, statut, message)
                VALUES (?, ?, 0, 'erreur', ?)
            """, (datetime.now().isoformat(), source_name, str(e)))

    db.commit()
    return {"total_new": total_new, "sources": results, "scan_date": datetime.now().isoformat()}

# ---------------------------------------------------------------------------
# Seed initial data to demonstrate the system
# ---------------------------------------------------------------------------
def seed_demo_data(db):
    """Insert demo alerts to show how the system works."""
    existing = db.execute("SELECT COUNT(*) FROM alertes").fetchone()[0]
    if existing > 0:
        return

    demos = [
        {
            "source": "ANSES",
            "categorie": "Alertes sanitaires",
            "titre": "Avis de l'ANSES relatif aux risques liés à la consommation de compléments alimentaires contenant de la levure de riz rouge",
            "resume": "L'ANSES recommande de limiter la consommation de monacoline K à 10 mg/jour et d'encadrer l'usage de levure de riz rouge dans les compléments alimentaires. Risques d'atteintes hépatiques et musculaires signalés.",
            "url": "https://www.anses.fr/fr/content/compl%C3%A9ments-alimentaires-%C3%A0-base-de-levure-de-riz-rouge-des-risques-pour-la-sant%C3%A9",
            "date_pub": "2026-02-15",
            "impact": "critique",
            "textes": "Arrêté 9 mai 2006"
        },
        {
            "source": "EUR-Lex / Cellar",
            "categorie": "Allégations",
            "titre": "Règlement d'exécution modifiant le registre des allégations nutritionnelles et de santé (Règlement 432/2012)",
            "resume": "Mise à jour du registre européen des allégations de santé autorisées. Ajout de nouvelles allégations pour la vitamine D et le magnésium. Suppression de certaines allégations non fondées scientifiquement.",
            "url": "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32012R0432",
            "date_pub": "2026-01-20",
            "impact": "important",
            "textes": "Règlement 432/2012, Règlement 1924/2006"
        },
        {
            "source": "Légifrance",
            "categorie": "Nutriments",
            "titre": "Projet de modification de l'arrêté du 9 mai 2006 — Révision des doses maximales de vitamines et minéraux",
            "resume": "La DGAL prépare une refonte de l'arrêté du 9 mai 2006 encadrant les nutriments dans les compléments alimentaires. Les doses maximales journalières de vitamine D et de zinc pourraient être révisées à la hausse, conformément aux derniers avis de l'ANSES et de l'EFSA.",
            "url": "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000454178/",
            "date_pub": "2026-02-28",
            "impact": "important",
            "textes": "Arrêté 9 mai 2006"
        },
        {
            "source": "DGCCRF",
            "categorie": "Étiquetage",
            "titre": "Rappel des obligations d'étiquetage des compléments alimentaires — Guide actualisé 2026",
            "resume": "La DGCCRF publie un guide actualisé sur les obligations d'étiquetage des compléments alimentaires, incluant les mentions spécifiques liées aux allergènes et aux nouveaux aliments. Renforcement des contrôles sur les allégations non autorisées.",
            "url": "https://www.economie.gouv.fr/dgccrf/complements-alimentaires",
            "date_pub": "2026-03-01",
            "impact": "info",
            "textes": "Règlement INCO 1169/2011, Directive 2002/46/CE"
        },
        {
            "source": "DGAL / Compl'Alim",
            "categorie": "Déclarations",
            "titre": "Évolution de la plateforme Compl'Alim — Nouvelles fonctionnalités pour les déclarations Article 16",
            "resume": "La DGAL annonce des améliorations de la plateforme Compl'Alim, notamment un module simplifié pour les déclarations en reconnaissance mutuelle (Article 16) et un suivi en temps réel de l'état des dossiers.",
            "url": "https://complalim.anses.fr/",
            "date_pub": "2026-02-10",
            "impact": "info",
            "textes": "Décret 2006-352"
        },
        {
            "source": "EFSA",
            "categorie": "Plantes",
            "titre": "EFSA Opinion on safety of botanical preparations in food supplements — Curcuma longa",
            "resume": "L'EFSA publie son évaluation de la sécurité des préparations à base de Curcuma longa dans les compléments alimentaires. Des limites de curcuminoïdes sont recommandées. Impact potentiel sur l'arrêté du 24 juin 2014.",
            "url": "https://www.efsa.europa.eu/",
            "date_pub": "2026-01-15",
            "impact": "important",
            "textes": "Arrêté 24 juin 2014"
        },
        {
            "source": "EUR-Lex / Cellar",
            "categorie": "Novel Food",
            "titre": "Mise à jour du catalogue Novel Food de l'UE — Nouveaux ingrédients autorisés",
            "resume": "Le catalogue des nouveaux aliments de l'Union européenne a été mis à jour avec l'autorisation de plusieurs nouvelles substances pouvant être utilisées dans les compléments alimentaires, dont le NMN (nicotinamide mononucléotide).",
            "url": "https://eur-lex.europa.eu/",
            "date_pub": "2026-03-05",
            "impact": "important",
            "textes": "Règlement Novel Food 2015/2283"
        },
        {
            "source": "Data.gouv.fr",
            "categorie": "Déclarations",
            "titre": "Publication des données Compl'Alim — T1 2026 : 847 nouvelles déclarations",
            "resume": "Le jeu de données ouvert des déclarations de compléments alimentaires a été mis à jour. 847 nouvelles déclarations enregistrées au T1 2026 via Compl'Alim. Les catégories les plus déclarées : immunité, fatigue, digestion.",
            "url": "https://www.data.gouv.fr/datasets/declarations-de-complements-alimentaires",
            "date_pub": "2026-03-07",
            "impact": "info",
            "textes": "Décret 2006-352"
        },
    ]

    now = datetime.now().isoformat()
    for d in demos:
        h = hash_alerte(d["source"], d["titre"], d["url"])
        db.execute("""
            INSERT OR IGNORE INTO alertes (hash, source, categorie, titre, resume, url, date_publication, date_detection, impact, textes_concernes, lu)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (h, d["source"], d["categorie"], d["titre"], d["resume"], d["url"], d["date_pub"], now, d["impact"], d["textes"]))

    db.commit()

seed_demo_data(db)

# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app):
    yield
    db.close()

app = FastAPI(title="RégulCA Veille API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "RégulCA Veille API", "time": datetime.now().isoformat()}


@app.get("/api/veille")
def get_alertes(
    categorie: str = Query(None),
    impact: str = Query(None),
    source: str = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    q: str = Query(None)
):
    """Get all regulatory alerts with optional filters."""
    query = "SELECT * FROM alertes WHERE 1=1"
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

    # Count total
    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    total = db.execute(count_query, params).fetchone()[0]

    query += " ORDER BY date_detection DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = db.execute(query, params).fetchall()
    alertes = [dict(r) for r in rows]

    return {"alertes": alertes, "total": total, "limit": limit, "offset": offset}


@app.get("/api/veille/stats")
def get_stats():
    """Get veille statistics."""
    total = db.execute("SELECT COUNT(*) FROM alertes").fetchone()[0]
    non_lues = db.execute("SELECT COUNT(*) FROM alertes WHERE lu = 0").fetchone()[0]
    critiques = db.execute("SELECT COUNT(*) FROM alertes WHERE impact = 'critique'").fetchone()[0]
    importants = db.execute("SELECT COUNT(*) FROM alertes WHERE impact = 'important'").fetchone()[0]

    # By category
    cats = db.execute("SELECT categorie, COUNT(*) as cnt FROM alertes GROUP BY categorie ORDER BY cnt DESC").fetchall()
    categories = [{"categorie": r["categorie"], "count": r["cnt"]} for r in cats]

    # By source
    srcs = db.execute("SELECT source, COUNT(*) as cnt FROM alertes GROUP BY source ORDER BY cnt DESC").fetchall()
    sources = [{"source": r["source"], "count": r["cnt"]} for r in srcs]

    # By impact
    impacts = db.execute("SELECT impact, COUNT(*) as cnt FROM alertes GROUP BY impact").fetchall()
    by_impact = {r["impact"]: r["cnt"] for r in impacts}

    # Recent scans
    scans = db.execute("SELECT * FROM scan_log ORDER BY date_scan DESC LIMIT 10").fetchall()
    recent_scans = [dict(s) for s in scans]

    # Last scan date
    last = db.execute("SELECT MAX(date_scan) as last FROM scan_log").fetchone()
    last_scan = last["last"] if last else None

    return {
        "total_alertes": total,
        "non_lues": non_lues,
        "critiques": critiques,
        "importants": importants,
        "by_category": categories,
        "by_source": sources,
        "by_impact": by_impact,
        "recent_scans": recent_scans,
        "last_scan": last_scan
    }


@app.get("/api/veille/sources")
def get_sources():
    """Get all monitored sources and their status."""
    rows = db.execute("SELECT * FROM sources ORDER BY nom").fetchall()
    return {"sources": [dict(r) for r in rows]}


@app.post("/api/veille/refresh")
def refresh_scan():
    """Trigger an immediate scan of all sources."""
    result = run_full_scan(db)
    return result


@app.post("/api/veille/mark-read/{alerte_id}")
def mark_read(alerte_id: int):
    """Mark an alert as read."""
    db.execute("UPDATE alertes SET lu = 1 WHERE id = ?", (alerte_id,))
    db.commit()
    return {"ok": True}


@app.post("/api/veille/mark-all-read")
def mark_all_read():
    """Mark all alerts as read."""
    db.execute("UPDATE alertes SET lu = 1 WHERE lu = 0")
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dossiers CRUD
# ---------------------------------------------------------------------------

@app.post("/api/dossiers", status_code=201)
def create_dossier(body: dict):
    """Créer un nouveau dossier réglementaire."""
    dossier_id = body.get("id")
    if not dossier_id:
        return {"error": "Champ 'id' requis"}, 400
    now = datetime.now().isoformat()
    data_json = json.dumps(body, ensure_ascii=False)
    try:
        db.execute(
            "INSERT INTO dossiers (id, data, date_creation, date_modification) VALUES (?, ?, ?, ?)",
            (dossier_id, data_json, now, now)
        )
        db.commit()
    except sqlite3.IntegrityError:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=409, content={"error": "Dossier déjà existant", "id": dossier_id})
    return {"ok": True, "id": dossier_id}


@app.get("/api/dossiers")
def list_dossiers():
    """Lister tous les dossiers."""
    rows = db.execute("SELECT id, data, date_creation, date_modification FROM dossiers ORDER BY date_modification DESC").fetchall()
    dossiers = []
    for r in rows:
        d = json.loads(r["data"])
        d["_date_creation"] = r["date_creation"]
        d["_date_modification"] = r["date_modification"]
        dossiers.append(d)
    return {"dossiers": dossiers}


@app.get("/api/dossiers/{dossier_id}")
def get_dossier(dossier_id: str):
    """Récupérer un dossier par son identifiant."""
    row = db.execute("SELECT data, date_creation, date_modification FROM dossiers WHERE id = ?", (dossier_id,)).fetchone()
    if not row:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": "Dossier non trouvé", "id": dossier_id})
    d = json.loads(row["data"])
    d["_date_creation"] = row["date_creation"]
    d["_date_modification"] = row["date_modification"]
    return {"dossier": d}


@app.put("/api/dossiers/{dossier_id}")
def update_dossier(dossier_id: str, body: dict):
    """Mettre à jour un dossier existant."""
    row = db.execute("SELECT id FROM dossiers WHERE id = ?", (dossier_id,)).fetchone()
    if not row:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": "Dossier non trouvé", "id": dossier_id})
    now = datetime.now().isoformat()
    data_json = json.dumps(body, ensure_ascii=False)
    db.execute(
        "UPDATE dossiers SET data = ?, date_modification = ? WHERE id = ?",
        (data_json, now, dossier_id)
    )
    db.commit()
    return {"ok": True, "id": dossier_id}


@app.delete("/api/dossiers/{dossier_id}")
def delete_dossier(dossier_id: str):
    """Supprimer un dossier."""
    row = db.execute("SELECT id FROM dossiers WHERE id = ?", (dossier_id,)).fetchone()
    if not row:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"error": "Dossier non trouvé", "id": dossier_id})
    db.execute("DELETE FROM dossiers WHERE id = ?", (dossier_id,))
    db.commit()
    return {"ok": True, "id": dossier_id}


STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
