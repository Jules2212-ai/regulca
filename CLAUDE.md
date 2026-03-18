# RégulCA — CLAUDE.md

## Projet
Module réglementaire compléments alimentaires — Laboratoire CCD
~5 utilisateurs, équipe réglementaire, données sensibles

## Stack
- Backend : FastAPI + Uvicorn (api_server.py)
- Frontend : HTML/CSS/JS vanilla (/static/)
- BDD : SQLite local / PostgreSQL production (détection auto via DATABASE_URL)
- Auth : JWT bcrypt (users.json) → Azure AD à venir

## État actuel
- Déployé sur Railway (URL publique)
- GitHub SSH : git@github.com:Jules2212-ai/regulca.git
- Auth login/password fonctionnelle
- Journal de bord : ~/Desktop/RégulCA_Journal.md

## Règles absolues
- Ne jamais modifier index.html et api_server.py simultanément
- Secrets dans .env uniquement
- Tester avec curl après chaque modif backend
- Mettre à jour RégulCA_Journal.md après chaque étape

## Prochaine étape
Configurer l'addon PostgreSQL sur Railway + redéployer
