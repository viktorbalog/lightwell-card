# Lightwell: the first release

## Goal

Lightwell published on GitHub and installable through HACS, first as a custom repository, later from HACS's default
list.

## Context

The card started as one home's floor plan card in a private Home Assistant configuration and was made general there,
in steps, before this repository was started from the result (on 2026-10-03, with no history: the private one keeps
it). This repository's first commit has the engine, the example homes, the tools, the README and the CI.

What's left: a GitHub repository, a first release, a check that HACS installs it, and later the default list.

## Approach

- The bundle is committed in `dist/`, so HACS can install from the repository itself; releases also carry it as an
  asset, built by the release workflow.
- `.github/workflows/validate.yml` runs the tests, checks that `dist/` and the examples' `home.js` match the source,
  and runs HACS's own validation.

## Steps

1. Create the GitHub repository (public), add it as `origin` and push. Set its description ("A living floor plan for
   Home Assistant") and topics (`home-assistant`, `hacs`, `lovelace`, `custom-card`, `floor-plan`).
2. Check that the validation workflow passes.
3. Tag `v0.1.0` and publish a release; the release workflow attaches `dist/lightwell-card.js`.
4. Install it through HACS as a custom repository in a real Home Assistant, and check a home renders with no console
   errors.
5. After it has been in use for a while: submit it to the HACS default list.

## Verification

As in the steps: the workflows pass on GitHub, and the card installs and renders through HACS.
