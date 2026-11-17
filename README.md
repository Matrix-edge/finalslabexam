# Harbor Health Clinic – Check-up Booking

A front-end-only check-up booking interface built with HTML, CSS, JavaScript and Bootstrap 5.

## Features
- 3-step flow: check-up and doctor, date and time, patient details
- Warnings and inline errors for missing choices, past or weekend dates, taken slots, invalid fields, duplicate or overlapping bookings
- Duration-aware time slots (a 60-minute check-up blocks two 30-minute slots)
- Confirm, cancel and start-over dialogs, with a late-cancellation warning (under 24 hours)
- Upcoming appointments saved in the browser with `localStorage`

## Run locally
Open `index.html` in a browser (internet needed for the Bootstrap CDN).

## Deploy with GitHub Pages
Push the repo, then go to **Settings → Pages**, choose the `main` branch and the `/ (root)` folder, and save.

## Notes
- There is no backend. Nothing is sent anywhere, and "already taken" slots are simulated in `taken()` in `js/app.js`.
- Do not use it to collect real patient data without adding a secure backend.
- Edit `SERVICES` and `DOCTORS` at the top of `js/app.js` to match your clinic.
