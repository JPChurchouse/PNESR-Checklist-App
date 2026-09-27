# PNESR Checklist App

Web app for the Palmerston North Esplanade Scenic Railway: pre-operation safety checks, station ticket
sales sheets (with float, takings and reconciliation), season stats, and printable paper versions of
the forms. It runs on phones and tablets, can be installed to the home screen, and works without signal.

All records are stored **on the device** (browser storage). Use *Backup and restore* regularly.
*Practice mode* is a separate sandbox with made-up staff and records for training.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # serve dist/ locally (offline support only works in this build)
```

Photos and the club logo are kept out of git. Put the originals in `fleet-images/` (`loco-<id>.jpg`,
`car-<id>.jpg`) and `brand-images/`, then run `npm run images`. The app shows placeholders without them.

## Deployment

`.github/workflows/deploy.yml` checks every push and publishes `main` to GitHub Pages
(set *Settings → Pages → Source* to *GitHub Actions* once). The built app is static files, so it can
also be served from any web server, e.g. a Raspberry Pi. Installing and offline use need HTTPS
(or `localhost`).
