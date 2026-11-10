#!/usr/bin/env bash
# Create or update the GitHub labels this project uses. Usage: scripts/labels.sh [owner/repo]
# Requires the GitHub CLI (`gh`) logged in with write access to the repository.
set -euo pipefail
repo="${1:-DeskMenace/Advent-Agent}"

label() { gh label create "$1" --color "$2" --description "$3" --repo "$repo" --force; }

label "bug"            "d73a4a" "Something does not work as expected"
label "agent-adapter"  "1d76db" "Support for a terminal AI agent"
label "kit-block"      "5319e7" "A building block in workshop/kit"
label "gift-idea"      "e99695" "A proposed idea for the gift library"
label "candidate"      "fbca04" "Idea entry awaiting maintainer review"
label "approved"       "0e8a16" "Idea entry approved by the maintainer"
label "good first issue" "7057ff" "Good for newcomers"
label "help wanted"    "008672" "Extra attention is welcome"
label "docs"           "0075ca" "Documentation and translations"
label "wontfix-scope"  "ffffff" "Out of scope for this project"
