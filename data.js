/* ===== REGULATORY DATA FOR FRENCH FOOD SUPPLEMENTS ===== */

var VITAMINES = [
  { nom: "Vitamine A", vnr: 800, unite: "µg", doseMax: 800, doseMaxNote: "µg ER" },
  { nom: "Vitamine D", vnr: 5, unite: "µg", doseMax: 25, doseMaxNote: "µg (1000 UI) — seuil usuel" },
  { nom: "Vitamine E", vnr: 12, unite: "mg", doseMax: 36, doseMaxNote: "mg α-ET (adulte)" },
  { nom: "Vitamine K", vnr: 75, unite: "µg", doseMax: 25, doseMaxNote: "µg" },
  { nom: "Vitamine C", vnr: 80, unite: "mg", doseMax: 1000, doseMaxNote: "mg" },
  { nom: "Vitamine B1 (Thiamine)", vnr: 1.1, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Vitamine B2 (Riboflavine)", vnr: 1.4, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Niacine (B3)", vnr: 16, unite: "mg", doseMax: 54, doseMaxNote: "mg (nicotinamide), 8 mg (acide nicotinique)" },
  { nom: "Acide pantothénique (B5)", vnr: 6, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Vitamine B6", vnr: 1.4, unite: "mg", doseMax: 5.4, doseMaxNote: "mg" },
  { nom: "Acide folique (B9)", vnr: 200, unite: "µg", doseMax: 200, doseMaxNote: "µg" },
  { nom: "Vitamine B12", vnr: 2.5, unite: "µg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Biotine (B8)", vnr: 50, unite: "µg", doseMax: null, doseMaxNote: "Pas de DJM fixée" }
];

var MINERAUX = [
  { nom: "Calcium", vnr: 800, unite: "mg", doseMax: 800, doseMaxNote: "mg" },
  { nom: "Phosphore", vnr: 700, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Magnésium", vnr: 375, unite: "mg", doseMax: 300, doseMaxNote: "mg" },
  { nom: "Fer", vnr: 14, unite: "mg", doseMax: 14, doseMaxNote: "mg" },
  { nom: "Zinc", vnr: 10, unite: "mg", doseMax: 15, doseMaxNote: "mg" },
  { nom: "Cuivre", vnr: 1, unite: "mg", doseMax: 2, doseMaxNote: "mg" },
  { nom: "Manganèse", vnr: 2, unite: "mg", doseMax: 3.5, doseMaxNote: "mg" },
  { nom: "Sélénium", vnr: 55, unite: "µg", doseMax: 200, doseMaxNote: "µg" },
  { nom: "Chrome", vnr: 40, unite: "µg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Molybdène", vnr: 50, unite: "µg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Iode", vnr: 150, unite: "µg", doseMax: 150, doseMaxNote: "µg" },
  { nom: "Potassium", vnr: 2000, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Chlorure", vnr: 800, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Fluorure", vnr: 3.5, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" },
  { nom: "Sodium", vnr: null, unite: "mg", doseMax: null, doseMaxNote: "Pas de DJM fixée" }
];

var PLANTES = [
  { nom: "Curcuma longa", famille: "Zingiberaceae", partie: "Rhizome", surveillance: "Curcuminoïdes à surveiller" },
  { nom: "Valeriana officinalis", famille: "Caprifoliaceae", partie: "Racine", surveillance: null },
  { nom: "Echinacea purpurea", famille: "Asteraceae", partie: "Parties aériennes, racine", surveillance: null },
  { nom: "Ginkgo biloba", famille: "Ginkgoaceae", partie: "Feuille", surveillance: "Acide ginkgolique à surveiller" },
  { nom: "Panax ginseng", famille: "Araliaceae", partie: "Racine", surveillance: "Ginsénosides à surveiller" },
  { nom: "Aloe vera / barbadensis", famille: "Asphodelaceae", partie: "Gel foliaire", surveillance: "Aloïne à surveiller" },
  { nom: "Cynara scolymus", famille: "Asteraceae", partie: "Feuille", surveillance: null },
  { nom: "Melissa officinalis", famille: "Lamiaceae", partie: "Feuille, sommité fleurie", surveillance: null },
  { nom: "Rhodiola rosea", famille: "Crassulaceae", partie: "Rhizome, racine", surveillance: null },
  { nom: "Silybum marianum", famille: "Asteraceae", partie: "Fruit", surveillance: "Silymarine" },
  { nom: "Harpagophytum procumbens", famille: "Pedaliaceae", partie: "Racine", surveillance: null },
  { nom: "Passiflora incarnata", famille: "Passifloraceae", partie: "Parties aériennes", surveillance: null },
  { nom: "Matricaria chamomilla", famille: "Asteraceae", partie: "Fleur", surveillance: null },
  { nom: "Camellia sinensis", famille: "Theaceae", partie: "Feuille", surveillance: "Caféine à surveiller" },
  { nom: "Olea europaea", famille: "Oleaceae", partie: "Feuille", surveillance: null },
  { nom: "Vitis vinifera", famille: "Vitaceae", partie: "Feuille, fruit, graine", surveillance: null },
  { nom: "Rosmarinus officinalis", famille: "Lamiaceae", partie: "Feuille, sommité fleurie", surveillance: null }
];

var ALLEGATIONS = {
  "Vitamine C": [
    { texte: "contribue au fonctionnement normal du système immunitaire", doseMin: 12, unite: "mg", pctVNR: 15 },
    { texte: "contribue à réduire la fatigue", doseMin: 12, unite: "mg", pctVNR: 15 },
    { texte: "contribue à la formation normale de collagène pour assurer le fonctionnement normal des os", doseMin: 12, unite: "mg", pctVNR: 15 }
  ],
  "Vitamine D": [
    { texte: "contribue au maintien d'une ossature normale", doseMin: 0.75, unite: "µg", pctVNR: 15 },
    { texte: "contribue au fonctionnement normal du système immunitaire", doseMin: 0.75, unite: "µg", pctVNR: 15 },
    { texte: "contribue à l'absorption et à l'utilisation normales du calcium et du phosphore", doseMin: 0.75, unite: "µg", pctVNR: 15 }
  ],
  "Zinc": [
    { texte: "contribue au fonctionnement normal du système immunitaire", doseMin: 1.5, unite: "mg", pctVNR: 15 },
    { texte: "contribue au maintien d'une peau normale", doseMin: 1.5, unite: "mg", pctVNR: 15 },
    { texte: "contribue au maintien d'une vision normale", doseMin: 1.5, unite: "mg", pctVNR: 15 }
  ],
  "Magnésium": [
    { texte: "contribue à réduire la fatigue", doseMin: 56.25, unite: "mg", pctVNR: 15 },
    { texte: "contribue à un métabolisme énergétique normal", doseMin: 56.25, unite: "mg", pctVNR: 15 },
    { texte: "contribue au fonctionnement normal du système nerveux", doseMin: 56.25, unite: "mg", pctVNR: 15 }
  ],
  "Fer": [
    { texte: "contribue à réduire la fatigue", doseMin: 2.1, unite: "mg", pctVNR: 15 },
    { texte: "contribue au transport normal de l'oxygène dans l'organisme", doseMin: 2.1, unite: "mg", pctVNR: 15 }
  ],
  "Calcium": [
    { texte: "contribue au maintien d'une ossature normale", doseMin: 120, unite: "mg", pctVNR: 15 },
    { texte: "contribue à un métabolisme énergétique normal", doseMin: 120, unite: "mg", pctVNR: 15 }
  ],
  "Sélénium": [
    { texte: "contribue au fonctionnement normal du système immunitaire", doseMin: 8.25, unite: "µg", pctVNR: 15 },
    { texte: "contribue à la protection des cellules contre le stress oxydatif", doseMin: 8.25, unite: "µg", pctVNR: 15 }
  ],
  "Vitamine B12": [
    { texte: "contribue à réduire la fatigue", doseMin: 0.375, unite: "µg", pctVNR: 15 },
    { texte: "contribue à un métabolisme énergétique normal", doseMin: 0.375, unite: "µg", pctVNR: 15 }
  ]
};

var MENTIONS_OBLIGATOIRES = [
  { id: 1, texte: "Dénomination « Complément alimentaire »", ref: "Directive 2002/46/CE Art. 6" },
  { id: 2, texte: "Liste des ingrédients (ordre décroissant)", ref: "Règlement INCO 1169/2011, Art. 18-20" },
  { id: 3, texte: "Allergènes en gras ou soulignés", ref: "Règlement INCO, Art. 21, Annexe II" },
  { id: 4, texte: "Quantité nette (poids ou volume)", ref: "Règlement INCO" },
  { id: 5, texte: "DLUO (Date Limite d'Utilisation Optimale)", ref: "Règlement INCO" },
  { id: 6, texte: "Conditions de conservation", ref: "Règlement INCO" },
  { id: 7, texte: "Nom et adresse de l'exploitant UE", ref: "Règlement INCO" },
  { id: 8, texte: "Pays d'origine (si applicable)", ref: "Règlement INCO" },
  { id: 9, texte: "Mode d'emploi / Dose journalière recommandée", ref: "Directive 2002/46/CE" },
  { id: 10, texte: "« Ne pas dépasser la dose journalière recommandée »", ref: "Directive 2002/46/CE" },
  { id: 11, texte: "« Les CA ne doivent pas être utilisés comme substituts d'un régime alimentaire varié »", ref: "Directive 2002/46/CE" },
  { id: 12, texte: "« Tenir hors de portée des jeunes enfants »", ref: "Directive 2002/46/CE" },
  { id: 13, texte: "Numéro de lot", ref: "Règlement INCO" },
  { id: 14, texte: "Tableau nutritionnel (quantités par dose + %VNR)", ref: "Directive 2002/46/CE" },
  { id: 15, texte: "Si allégation : « Alimentation variée et équilibrée et mode de vie sain »", ref: "Règlement 1924/2006" }
];

var REGLEMENTS = {
  francais: [
    { titre: "Décret 2006-352", desc: "Cadre général des compléments alimentaires en France. Définit les conditions de mise sur le marché et la procédure de déclaration.", lien: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000638341/" },
    { titre: "Arrêté du 9 mai 2006", desc: "Liste des nutriments (vitamines et minéraux) pouvant être employés dans les compléments alimentaires, leurs formes chimiques et doses maximales.", lien: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000454178/" },
    { titre: "Arrêté du 24 juin 2014", desc: "Liste des plantes autorisées dans les compléments alimentaires et des conditions d'emploi des préparations de plantes.", lien: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000029254516/" }
  ],
  europeens: [
    { titre: "Directive 2002/46/CE", desc: "Directive européenne relative au rapprochement des législations des États membres concernant les compléments alimentaires.", lien: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32002L0046" },
    { titre: "Règlement INCO 1169/2011", desc: "Règlement concernant l'information des consommateurs sur les denrées alimentaires. Base de l'étiquetage obligatoire.", lien: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32011R1169" },
    { titre: "Règlement 1924/2006", desc: "Règlement sur les allégations nutritionnelles et de santé portant sur les denrées alimentaires.", lien: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32006R1924" },
    { titre: "Règlement 432/2012", desc: "Liste des allégations de santé autorisées portant sur les denrées alimentaires.", lien: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32012R0432" }
  ],
  ressources: [
    { titre: "Compl'Alim — Télédéclaration", desc: "Plateforme de télédéclaration des compléments alimentaires auprès de la DGAL.", lien: "https://complalim.anses.fr/" },
    { titre: "ANSES — Compléments alimentaires", desc: "Avis et rapports de l'Agence nationale de sécurité sanitaire sur les compléments alimentaires.", lien: "https://www.anses.fr/fr/content/les-compl%C3%A9ments-alimentaires" },
    { titre: "DGCCRF — Compléments alimentaires", desc: "Informations de la Direction générale de la concurrence, de la consommation et de la répression des fraudes.", lien: "https://www.economie.gouv.fr/dgccrf/complements-alimentaires" }
  ]
};

var CATEGORIES = ["Gélule", "Comprimé", "Poudre", "Liquide", "Gomme"];
var POPULATIONS = ["Adultes", "Enfants (>3 ans)", "Adolescents", "Femmes enceintes", "Femmes allaitantes", "Personnes âgées", "Sportifs"];
var TYPES_INGREDIENTS = ["Vitamine", "Minéral", "Plante", "Substance", "Excipient", "Additif"];
var UNITES = ["mg", "µg", "g", "UI", "mL"];

/* Build lookup maps for quick compliance checks */
var VNR_MAP = {};
var DOSE_MAX_MAP = {};

VITAMINES.forEach(function(v) {
  VNR_MAP[v.nom] = { vnr: v.vnr, unite: v.unite };
  if (v.doseMax !== null) {
    DOSE_MAX_MAP[v.nom] = { max: v.doseMax, unite: v.unite, note: v.doseMaxNote };
  }
});

MINERAUX.forEach(function(m) {
  VNR_MAP[m.nom] = { vnr: m.vnr, unite: m.unite };
  if (m.doseMax !== null) {
    DOSE_MAX_MAP[m.nom] = { max: m.doseMax, unite: m.unite, note: m.doseMaxNote };
  }
});

var PLANTES_MAP = {};
PLANTES.forEach(function(p) {
  PLANTES_MAP[p.nom] = p;
});

/* All known authorized ingredient names */
var AUTHORIZED_VITAMINS = VITAMINES.map(function(v) { return v.nom; });
var AUTHORIZED_MINERALS = MINERAUX.map(function(m) { return m.nom; });
var AUTHORIZED_PLANTS = PLANTES.map(function(p) { return p.nom; });
