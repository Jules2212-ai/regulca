# RégulCA — CLAUDE.md

## Projet
Module réglementaire compléments alimentaires + médicaments
Groupe Patrick Choay SA (Laboratoire CCD + Bailly Creat)
~5-10 utilisateurs, équipe réglementaire, données sensibles

## Stack
- Backend : FastAPI + Uvicorn (api_server.py + api_medicament.py)
- Frontend : HTML/CSS/JS vanilla (/static/)
- BDD : SQLite local / PostgreSQL production (détection auto via DATABASE_URL)
- Auth : JWT bcrypt (users.json) → Azure AD à venir
- IA : API Claude via claude_service.py (ANTHROPIC_API_KEY)

## État actuel
- Déployé sur Railway (URL publique)
- GitHub SSH : git@github.com:Jules2212-ai/regulca.git
- Auth login/password fonctionnelle
- Module CA : veille, dossiers, vérification formule, étiquetage, allégations
- Module Médicament : CTD CRUD, variations catalogue+IA, traduction FR↔EN, veille médicament
- Journal de bord : ~/Desktop/RégulCA_Journal.md

## Fichiers clés
- api_server.py — Routes CA + auth + veille CA + Database wrapper
- api_medicament.py — Routes CTD, variations, traduction, veille médicament (APIRouter)
- claude_service.py — Couche Claude API isolée (génération, classification, traduction)
- variations_catalogue.py — Catalogue des variations (données statiques)
- glossaire_pharma.py — Glossaire FR↔EN seed (32 termes)
- app.js — Frontend CA + routing + sidebar injection
- app_medicament.js — Frontend médicament (4 sections)

## Règles absolues
- Ne jamais modifier index.html et api_server.py simultanément
- Secrets dans .env uniquement
- Tester avec curl après chaque modif backend
- Mettre à jour RégulCA_Journal.md après chaque étape
- Ne jamais push sans validation explicite de Jules

## Prochaine étape
Auth Microsoft Azure AD SSO
