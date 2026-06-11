# OpenAI Cost Analyzer

Application web statique pour analyser un export ChatGPT et estimer ce que les mêmes conversations auraient coûté via l'API OpenAI.

## Utilisation

Ouvrez `index.html` dans un navigateur moderne, puis importez `conversations.json` depuis l'archive d'export ChatGPT. L'application fonctionne entièrement côté navigateur et ne transmet aucun contenu à un serveur.

Fonctionnalités principales :

- import par sélection ou glisser-déposer ;
- support `conversations.json` et fallback `chat.html` ;
- filtres de période ;
- estimation de tokens simple ou par mots ;
- analyse par modèle détecté dans l'export ;
- coûts simulés par niveau de raisonnement ;
- comparaison avec un abonnement ChatGPT Plus configurable ;
- graphiques, recherche, tri, pagination, export CSV et JSON ;
- mode clair/sombre et PWA lorsque servie en HTTP(S).

## Sources de prix

Le fichier `config/pricing.json` a été généré le 2026-06-11 depuis la page officielle OpenAI API Pricing :

https://openai.com/api/pricing/

Les tarifs exacts disponibles sur cette page au moment de la génération ont été inclus pour GPT-5.5, GPT-5.4 et GPT-5.4 mini. Les autres modèles courants sont volontairement marqués `unknown` lorsqu'aucun tarif exact n'a été repris dans le fichier local. L'application conserve ces modèles dans l'analyse mais affiche `N/D` pour le coût.

## Raisonnement

Les exports ChatGPT ne contiennent pas les tokens internes de raisonnement. Aucune source officielle stable ne publie de multiplicateurs universels par niveau (`low`, `medium`, `high`, `very_high`). Pour ne pas inventer de coefficients, `config/reasoning_profiles.json` les initialise tous à `1.0`. L'interface permet de les modifier localement pour tester des scénarios.

## Export ChatGPT

Procédure vérifiée le 2026-06-11 dans l'article OpenAI Help Center "How do I export my ChatGPT history and data?" :

1. Se connecter à ChatGPT.
2. Ouvrir le profil puis Settings.
3. Ouvrir Data Controls.
4. Sous Export Data, cliquer Export puis Confirm export.
5. Télécharger l'archive depuis l'email reçu.
6. Décompresser l'archive et importer `conversations.json`.

OpenAI indique que les exports peuvent prendre jusqu'à 7 jours et que le lien de téléchargement expire après 24 heures. Les exports ne sont pas disponibles pour les comptes ChatGPT Business ou Enterprise.

## Limites

Les résultats sont des estimations, pas une facture officielle. Les tokens sont approximés localement, les prix API changent dans le temps et certains modèles détectés peuvent ne pas avoir de tarif local connu.

## Développement

Aucune dépendance Node.js n'est nécessaire. Pour tester la PWA/service worker, servez le dossier en HTTP :

```bash
python3 -m http.server 8080
```

Puis ouvrez `http://localhost:8080`.
