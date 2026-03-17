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

## Hébergement
- Déployé sur Railway (URL publique active et fonctionnelle)
- Cible long terme : VPS OVH France (souveraineté des données)
- Code sur GitHub : https://github.com/Jules2212-ai/regulca

## Où on en est réellement
- App déployée sur Railway (pas OVH pour l'instant)
- URL publique Railway active et fonctionnelle
- Code poussé sur GitHub : https://github.com/Jules2212-ai/regulca
- Backend CRUD dossiers opérationnel (5 endpoints)
- Base SQLite éphémère sur Railway (à migrer vers PostgreSQL plus tard)
- Script RégulCA.command sur le Bureau (lancement local)

## Conventions de développement
- Commentaires en français
- Secrets dans fichier .env (jamais hardcodés dans le code)
- Tester avec curl après chaque modification backend
- Ne jamais modifier index.html et api_server.py en même temps

## Prochaine étape
Ajouter l'authentification Microsoft Azure AD SSO :
- Page de login avec bouton "Se connecter avec Microsoft"
- Protection de toutes les routes (frontend + backend)
- Utilisateurs identifiés par leur email @ccd.fr
- Secrets Azure dans .env (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)
