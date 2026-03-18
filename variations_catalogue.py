"""
RégulCA — Catalogue des variations réglementaires
Basé sur le Règlement (CE) n°1234/2008 et la Classification Guideline C(2013) 2804.
"""

# Structure : liste de dicts, chaque entrée = une catégorie de variation
# Champs : code, titre, types_possibles, description, conditions
CATALOGUE = [
    # --- Catégorie A : Changements administratifs ---
    {
        "code": "A.1",
        "titre": "Changement nom/adresse du titulaire AMM",
        "categorie": "A",
        "categorie_titre": "Changements administratifs",
        "types_possibles": ["IAIN"],
        "description": "Modification du nom et/ou de l'adresse du titulaire de l'autorisation de mise sur le marché.",
        "conditions": {
            "IAIN": "Notification immédiate avec documents justificatifs (extrait Kbis, certificat)."
        }
    },
    {
        "code": "A.2",
        "titre": "Changement nom du médicament",
        "categorie": "A",
        "categorie_titre": "Changements administratifs",
        "types_possibles": ["IB"],
        "description": "Modification de la dénomination commerciale du médicament.",
        "conditions": {
            "IB": "Justification du changement. Vérification absence de confusion avec d'autres spécialités."
        }
    },
    {
        "code": "A.4",
        "titre": "Changement fabricant SA ou PF",
        "categorie": "A",
        "categorie_titre": "Changements administratifs",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Remplacement ou ajout d'un site de fabrication de la substance active ou du produit fini.",
        "conditions": {
            "IA": "Nouveau site déjà autorisé pour un produit similaire, même procédé.",
            "IB": "Nouveau site, procédé identique, données comparatives fournies.",
            "II": "Nouveau site avec modifications significatives du procédé."
        }
    },
    {
        "code": "A.5",
        "titre": "Changement fournisseur excipient/matière première",
        "categorie": "A",
        "categorie_titre": "Changements administratifs",
        "types_possibles": ["IA", "IB"],
        "description": "Remplacement du fournisseur d'un excipient ou d'une matière première.",
        "conditions": {
            "IA": "Même grade, mêmes spécifications, excipient de pharmacopée.",
            "IB": "Spécifications légèrement différentes ou excipient hors pharmacopée."
        }
    },
    {
        "code": "A.6",
        "titre": "Changement responsable pharmacovigilance",
        "categorie": "A",
        "categorie_titre": "Changements administratifs",
        "types_possibles": ["IAIN"],
        "description": "Changement de la personne qualifiée responsable de la pharmacovigilance (QPPV).",
        "conditions": {
            "IAIN": "CV et qualification de la nouvelle QPPV. Notification dans les 12 mois."
        }
    },
    {
        "code": "A.7",
        "titre": "Suppression d'une forme/dosage/présentation",
        "categorie": "A",
        "categorie_titre": "Changements administratifs",
        "types_possibles": ["IAIN"],
        "description": "Retrait volontaire d'une présentation, d'un dosage ou d'une forme pharmaceutique.",
        "conditions": {
            "IAIN": "Notification avec justification. Impact sur la disponibilité à évaluer."
        }
    },

    # --- Catégorie B : Changements qualité ---
    {
        "code": "B.I.a",
        "titre": "Changement procédé fabrication SA",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification du procédé de fabrication de la substance active.",
        "conditions": {
            "IA": "Changement mineur sans impact sur les impuretés ou les spécifications.",
            "IB": "Changement modéré, données comparatives de qualité fournies.",
            "II": "Changement majeur du procédé de synthèse, nouvelles impuretés possibles."
        }
    },
    {
        "code": "B.I.b",
        "titre": "Changement spécifications SA",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification des spécifications de la substance active (limites, méthodes).",
        "conditions": {
            "IA": "Resserrement de limites ou ajout d'un paramètre de contrôle.",
            "IB": "Modification de méthode analytique avec résultats équivalents.",
            "II": "Élargissement de limites ou suppression d'un paramètre de contrôle."
        }
    },
    {
        "code": "B.I.d",
        "titre": "Changement durée validité SA",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification de la durée de validité ou des conditions de stockage de la substance active.",
        "conditions": {
            "IA": "Réduction de la durée de validité.",
            "IB": "Extension ≤ 6 mois avec données de stabilité conformes ICH.",
            "II": "Extension > 6 mois ou changement de conditions de stockage."
        }
    },
    {
        "code": "B.II.a",
        "titre": "Changement composition PF",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification de la composition qualitative ou quantitative du produit fini.",
        "conditions": {
            "IA": "Changement fournisseur excipient, même grade et spécifications.",
            "IB": "Modification quantitative mineure d'excipient (<10%), sans impact biopharmaceutique.",
            "II": "Ajout/suppression d'excipient, changement quantitatif significatif."
        }
    },
    {
        "code": "B.II.b",
        "titre": "Changement procédé fabrication PF",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification du procédé de fabrication du produit fini.",
        "conditions": {
            "IA": "Changement mineur (ex: temps de mélange), résultat dans les spécifications.",
            "IB": "Changement modéré avec données de validation.",
            "II": "Changement majeur du procédé (ex: granulation humide → sèche)."
        }
    },
    {
        "code": "B.II.c",
        "titre": "Changement spécifications PF",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification des spécifications du produit fini.",
        "conditions": {
            "IA": "Resserrement de limites.",
            "IB": "Modification de méthode analytique (résultats équivalents).",
            "II": "Élargissement de limites ou suppression de paramètre."
        }
    },
    {
        "code": "B.II.d",
        "titre": "Changement conditionnement PF",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification du conditionnement primaire ou secondaire du produit fini.",
        "conditions": {
            "IA": "Changement conditionnement secondaire sans impact sur la stabilité.",
            "IB": "Changement conditionnement primaire, même matériau, données de stabilité.",
            "II": "Nouveau matériau de conditionnement primaire."
        }
    },
    {
        "code": "B.II.e",
        "titre": "Changement durée conservation PF",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB", "II"],
        "description": "Modification de la durée de conservation ou des conditions de conservation du produit fini.",
        "conditions": {
            "IA": "Réduction de la durée de conservation.",
            "IB": "Extension ≤ 6 mois, données de stabilité conformes ICH Q1A.",
            "II": "Extension > 6 mois ou nouvelles conditions de conservation."
        }
    },
    {
        "code": "B.II.f",
        "titre": "Changement taille de lot PF",
        "categorie": "B",
        "categorie_titre": "Changements qualité",
        "types_possibles": ["IA", "IB"],
        "description": "Modification de la taille de lot de fabrication du produit fini.",
        "conditions": {
            "IA": "Scale-up ou scale-down ≤ 10x, procédé linéairement scalable.",
            "IB": "Scale-up > 10x avec données de validation sur lots industriels."
        }
    },

    # --- Catégorie C : Changements sécurité/efficacité/pharmacovigilance ---
    {
        "code": "C.I.1",
        "titre": "Ajout/modification indication thérapeutique",
        "categorie": "C",
        "categorie_titre": "Changements sécurité/efficacité",
        "types_possibles": ["II", "Extension"],
        "description": "Ajout d'une nouvelle indication ou modification d'une indication existante.",
        "conditions": {
            "II": "Modification d'indication basée sur de nouvelles données cliniques.",
            "Extension": "Nouvelle indication dans une population significativement différente."
        }
    },
    {
        "code": "C.I.2",
        "titre": "Modification posologie",
        "categorie": "C",
        "categorie_titre": "Changements sécurité/efficacité",
        "types_possibles": ["IB", "II"],
        "description": "Modification du schéma posologique ou de la durée de traitement.",
        "conditions": {
            "IB": "Clarification ou reformulation sans changement de la dose.",
            "II": "Modification de la dose recommandée basée sur des données cliniques."
        }
    },
    {
        "code": "C.I.4",
        "titre": "Modification contre-indications",
        "categorie": "C",
        "categorie_titre": "Changements sécurité/efficacité",
        "types_possibles": ["IB", "II"],
        "description": "Ajout, suppression ou modification de contre-indications.",
        "conditions": {
            "IB": "Ajout d'une contre-indication basée sur la littérature.",
            "II": "Modification significative basée sur de nouvelles données de sécurité."
        }
    },
    {
        "code": "C.I.6",
        "titre": "Modification RCP sections sécurité",
        "categorie": "C",
        "categorie_titre": "Changements sécurité/efficacité",
        "types_possibles": ["IB", "II"],
        "description": "Modification des sections 4.4 (mises en garde), 4.5 (interactions), 4.8 (effets indésirables) du RCP.",
        "conditions": {
            "IB": "Mise à jour en accord avec les données publiées.",
            "II": "Nouvelles données de pharmacovigilance significatives."
        }
    },
    {
        "code": "C.I.9",
        "titre": "Modification PGR (Plan Gestion Risques)",
        "categorie": "C",
        "categorie_titre": "Changements sécurité/efficacité",
        "types_possibles": ["IB", "II"],
        "description": "Mise à jour du Plan de Gestion des Risques.",
        "conditions": {
            "IB": "Mise à jour de routine du PGR.",
            "II": "Ajout de nouveaux risques identifiés ou nouvelles mesures de minimisation."
        }
    },
    {
        "code": "C.I.11",
        "titre": "Nouvelles données pharmacovigilance",
        "categorie": "C",
        "categorie_titre": "Changements sécurité/efficacité",
        "types_possibles": ["II"],
        "description": "Soumission de nouvelles données de pharmacovigilance impactant le rapport bénéfice/risque.",
        "conditions": {
            "II": "Évaluation obligatoire par l'autorité compétente."
        }
    },
]


def get_catalogue():
    """Retourner le catalogue complet, structuré par catégorie."""
    categories = {}
    for var in CATALOGUE:
        cat = var["categorie"]
        if cat not in categories:
            categories[cat] = {
                "code": cat,
                "titre": var["categorie_titre"],
                "variations": []
            }
        categories[cat]["variations"].append({
            "code": var["code"],
            "titre": var["titre"],
            "types_possibles": var["types_possibles"],
            "description": var["description"],
            "conditions": var["conditions"],
        })
    return list(categories.values())
