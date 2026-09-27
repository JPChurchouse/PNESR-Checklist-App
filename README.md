# PNESR Checklist App

Web app for the Palmerston North Esplanade Scenic Railway: pre-operation safety checks, station ticket
sales sheets (with float, takings and reconciliation), season stats, and printable paper versions of
the forms. It runs on phones and tablets, can be installed to the home screen, and works without signal.

All records are stored **on the device** (browser storage). Use *Backup and restore* regularly.

## Trying it out

**Easiest: open the web link** (no download or setup):
<https://jpchurchouse.github.io/PNESR-Checklist-App/>
On a phone or tablet, use *Install app* on the home screen (or on iPhone/iPad: Share → *Add to Home Screen*).

Once there, go to **Practice mode** (bottom of the home screen) → *Start practice mode* → *Add a sample
season*. That gives you a made-up staff list and about 15 months of made-up records to explore:

- **Pre-operation safety check**: start today's check, add trains, tick the checks, sign with your finger,
  then *Amend* it to swap a loco.
- **Victoria / Playground Station tickets**: save the start of the shift, then finish the takings and
  sign off; try *Correct a mistake* afterwards.
- **Season stats**: the dashboard, filled from the sample season.
- **Printable forms**: the paper fallback versions.

Nothing done in practice mode affects real records; practice PDFs are stamped PRACTICE. *Leave practice
mode* returns to the real (empty) app.

## Running it on your own computer (developers)

Needs [Node.js](https://nodejs.org/) 20.19 or newer.

```sh
git clone https://github.com/JPChurchouse/PNESR-Checklist-App.git
cd PNESR-Checklist-App
npm install
npm run dev        # then open http://localhost:5173
```

Other commands:

```sh
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # serve dist/ locally (offline support only works in this build)
npm run images     # re-make the web-sized photos from originals in fleet-images/ and brand-images/
```

## Deployment

`.github/workflows/deploy.yml` checks every push and publishes `main` to GitHub Pages
(set *Settings → Pages → Source* to *GitHub Actions* once). The built app is static files, so it can
also be served from any web server, e.g. a Raspberry Pi. Installing and offline use need HTTPS
(or `localhost`).

## Licence

[Elastic License 2.0](LICENSE) with an extra permission. In short, and not a substitute for the
[LICENSE](LICENSE) file itself:

- You may use, copy, change and share this software, including for another railway or organisation.
- An organisation may host its own copy for its own members, staff and volunteers.
- You may not offer it to others as a hosted or managed service (software as a service).
- Keep the licence and copyright notices, and say clearly that you've changed it if you have.
- The railway's name, logo and photos are not included in the licence; use your own.
