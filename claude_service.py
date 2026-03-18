"""
RégulCA — Service d'intégration Claude API
Couche isolée pour tous les appels à l'API Anthropic.
Gère : génération CTD, classification variations, traduction.
"""

import os
import json

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# Modèles par usage (cf. cahier des charges)
MODEL_GENERATION = "claude-sonnet-4-6"
MODEL_CLASSIFICATION = "claude-haiku-4-5"
MODEL_TRANSLATION = "claude-sonnet-4-6"
MODEL_CRITICAL = "claude-opus-4-6"


def _get_client():
    """Obtenir un client Anthropic. Lève une erreur si la clé n'est pas configurée."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY non configurée. "
            "Ajoutez-la dans le fichier .env pour activer les fonctionnalités IA."
        )
    import anthropic
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def is_available():
    """Vérifier si l'API Claude est configurée."""
    return bool(ANTHROPIC_API_KEY)


def generate_ctd_section(module_num, section, data, language="fr"):
    """Générer une section CTD via l'API Claude.

    Args:
        module_num: Numéro du module CTD (1-5)
        section: Identifiant de la section (ex: "2.3", "3.2.S.1")
        data: Dictionnaire avec les données du formulaire
        language: "fr" ou "en"

    Returns:
        dict avec "content" (texte généré) et "model" (modèle utilisé)
    """
    client = _get_client()

    lang_instruction = "en anglais" if language == "en" else "en français"
    data_text = json.dumps(data, ensure_ascii=False, indent=2)

    system_prompt = (
        "Tu es un expert en affaires réglementaires pharmaceutiques. "
        "Tu rédiges des sections du Common Technical Document (CTD) "
        "conformément aux guidelines ICH M4. "
        "Tes textes sont factuels, précis, structurés et conformes aux standards réglementaires. "
        "Tu inclus les références croisées vers les autres modules quand c'est pertinent."
    )

    user_prompt = (
        f"Rédige la section {section} du Module {module_num} du CTD "
        f"{lang_instruction}, à partir des données suivantes :\n\n"
        f"{data_text}\n\n"
        f"Le texte doit suivre la structure ICH et être directement utilisable "
        f"dans un dossier d'enregistrement."
    )

    # Utiliser le modèle critique pour les sections de synthèse (Module 2)
    model = MODEL_CRITICAL if module_num == 2 else MODEL_GENERATION

    try:
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        return {
            "content": response.content[0].text,
            "model": model,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
        }
    except Exception as e:
        raise RuntimeError(f"Erreur API Claude lors de la génération CTD : {str(e)}")


def classify_variation(description):
    """Classifier une variation à partir d'une description libre.

    Args:
        description: Description du changement en langage naturel

    Returns:
        dict avec classification, justification, documents_requis, cover_letter, sections_ctd
    """
    client = _get_client()

    system_prompt = (
        "Tu es un expert en variations réglementaires pharmaceutiques "
        "(Règlement CE 1234/2008, Classification Guideline C(2013) 2804). "
        "Tu analyses des descriptions de changements et tu retournes une classification "
        "structurée au format JSON strict."
    )

    user_prompt = (
        f"L'utilisateur décrit le changement suivant :\n\n"
        f'"{description}"\n\n'
        f"Analyse ce changement et retourne un JSON avec exactement ces clés :\n"
        f'{{\n'
        f'  "categorie": "ex: B.II.a",\n'
        f'  "sous_categorie": "ex: B.II.a.2.a",\n'
        f'  "type_variation": "IA | IAIN | IB | II | Extension",\n'
        f'  "titre": "titre court du type de variation",\n'
        f'  "justification": "justification réglementaire en 2-3 phrases",\n'
        f'  "documents_requis": ["liste", "des", "documents"],\n'
        f'  "sections_ctd_impactees": ["3.2.P.4", "3.2.P.1"],\n'
        f'  "delai_reglementaire": "ex: Notification immédiate",\n'
        f'  "cover_letter": "texte complet de la cover letter en français"\n'
        f'}}\n\n'
        f"Retourne UNIQUEMENT le JSON, sans texte avant ni après."
    )

    try:
        response = client.messages.create(
            model=MODEL_CLASSIFICATION,
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        text = response.content[0].text.strip()
        # Extraire le JSON (peut être entouré de ```json...```)
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(text)
        result["_model"] = MODEL_CLASSIFICATION
        return result
    except json.JSONDecodeError:
        raise RuntimeError("L'IA n'a pas retourné un JSON valide pour la classification.")
    except Exception as e:
        raise RuntimeError(f"Erreur API Claude lors de la classification : {str(e)}")


def translate_text(text, source_lang="fr", target_lang="en", pharma_mode=True):
    """Traduire du texte avec terminologie pharmaceutique.

    Args:
        text: Texte à traduire
        source_lang: "fr" ou "en"
        target_lang: "fr" ou "en"
        pharma_mode: Si True, utilise la terminologie pharmaceutique réglementaire

    Returns:
        dict avec "translated_text" et "glossary_terms" (termes spécialisés utilisés)
    """
    client = _get_client()

    lang_names = {"fr": "français", "en": "anglais"}
    src = lang_names.get(source_lang, source_lang)
    tgt = lang_names.get(target_lang, target_lang)

    system_prompt = (
        f"Tu es un traducteur professionnel spécialisé en réglementation pharmaceutique. "
        f"Tu traduis du {src} vers le {tgt}."
    )

    if pharma_mode:
        system_prompt += (
            " Tu utilises la terminologie officielle pharmaceutique et réglementaire : "
            "AMM = Marketing Authorisation, RCP = SmPC, DCI = INN, BPF = GMP, "
            "PGR = RMP, EIG = SAE, CEP = CoS, etc. "
            "Tu respectes les conventions terminologiques de l'ICH, l'EMA et l'ANSM."
        )

    user_prompt = (
        f"Traduis le texte suivant du {src} vers le {tgt}. "
        f"Retourne un JSON avec deux clés :\n"
        f'- "translated_text": le texte traduit\n'
        f'- "glossary_terms": liste des termes techniques traduits sous forme '
        f'[{{"source": "terme original", "target": "traduction"}}]\n\n'
        f"Texte à traduire :\n\n{text}\n\n"
        f"Retourne UNIQUEMENT le JSON."
    )

    try:
        response = client.messages.create(
            model=MODEL_TRANSLATION,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        result_text = response.content[0].text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(result_text)
        result["_model"] = MODEL_TRANSLATION
        return result
    except json.JSONDecodeError:
        raise RuntimeError("L'IA n'a pas retourné un JSON valide pour la traduction.")
    except Exception as e:
        raise RuntimeError(f"Erreur API Claude lors de la traduction : {str(e)}")
