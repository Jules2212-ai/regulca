# RégulCA — Module Réglementaire Compléments Alimentaires

## Contexte CCD
- Laboratoire CCD, groupe pharmaceutique familial français, santé féminine
- 220 collaborateurs, 30 marques, 110+ pays
- Utilisateurs : équipe réglementaire (~5 personnes), tous sur Microsoft 365 / Azure AD
- Données réglementaires sensibles — hébergement souverain obligatoire

## Stack technique
- Backend : FastAPI + Uvicorn — api_server.py
- Frontend : HTML/CSS/JS vanilla servi via /static/
- BDD : SQLite (veille.db)
- Auth : Microsoft Azure AD SSO (à implémenter)

## Hébergement cible
- VPS OVH France (Gravelines ou Strasbourg) — cloud souverain français
- HTTPS via Let's Encrypt + Nginx reverse proxy
- Données ne quittent pas la France

## Ce qui fonctionne
- Backend + frontend unifiés sur port 8000
- Veille réglementaire avec alertes démo
- Script de lancement RégulCA.command

## Conventions de développement
- Commentaires en français
- Secrets dans fichier .env (jamais hardcodés dans le code)
- Tester avec curl après chaque modification backend
- Ne jamais modifier index.html et api_server.py en même temps

## Prochaine étape
Préparer le déploiement sur VPS OVH : requirements.txt,
configuration Nginx, script de démarrage systemd.
