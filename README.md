# Private Birthday Invitation

A five-screen, mobile-first birthday invitation hosted free on GitHub Pages. No frameworks, build tools, paid services, or guest logins.

Party details and the guest list **do not live in this public repo**. They stay in your private Google Apps Script and Google Sheet. The site only gets the details when a guest's link carries the right invite code.

## How it works

1. **Welcome:** ivory envelope with a gold lining and black bow. Opens on tap.
2. **Reveal:** birthday announcement with confetti and a personalized greeting.
3. **Details:** date, location, dress code, theme, live countdown, and Google Maps link.
4. **RSVP:** name, attending or declining, optional guest.
5. **Finale:** closing message, a cake whose candles guests can blow out, and calendar buttons.

Also included: an optional music-box "Happy Birthday" that never autoplays, reduced-motion support, and no analytics or tracking.

```text
index.html            All five screens (no party details)
styles.css            Design; colours and fonts are tokens at the top
app.js                Navigation, invite code, RSVP, music, calendar
config.js             PUBLIC settings: script URL, plus-one option, preview sample
google-apps-script/   Code.gs template with placeholders only
private/              Ignored by git: your real script copy and invite link
```

## Changing party details

Details are in `EVENT_DETAILS` in your Apps Script project, not in this repo:

1. Open the project at [script.google.com](https://script.google.com) and edit `EVENT_DETAILS`.
2. Click **Save**.
3. Click **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Saving alone does not update the live invitation.

Keep `private/Code.deployed.gs` in step if you use it as your backup. `dateTime` needs the UTC offset for the party's location on that date.

## Changing the photo

The photo is also private, stored in `PHOTO_DATA` in Apps Script rather than in this repo. Compress it to about 100 KB, convert it to a `data:image/jpeg;base64,...` string, paste it in, update `photoAlt`, and deploy a new version. Leave `PHOTO_DATA` empty to show no photo.

## Sending invitations

Send each guest the link in `private/invite-link.txt` with their name in place of `NAME`. Use `%20` for spaces:

```text
https://miinamoeini.github.io/birthday-invitation/?guest=Jamie%20Lee&code=YOUR_CODE
```

Without a valid code, a visitor sees only the envelope and a code prompt.

**To change the code** (for example, if a link spreads too far): edit `INVITE_CODE` in Apps Script and deploy a new version as above. Every old link stops working, so send guests new ones.

## Privacy: what this does and doesn't protect

- Nothing private is in this repo or the published site files. Keep it that way: never commit `private/` or real values in `Code.gs`.
- The code is shared by all guests, so anyone holding a link can open it, and guests can forward links or take screenshots. Only send it to people you trust.
- The code and RSVP answers travel in HTTPS request URLs, which can appear in browser history and service logs. Collect only what you need.
- The Apps Script URL in `config.js` is public by design. It returns nothing and saves nothing without the code.
- Apps Script and Sheets have usage quotas, which are generous for a personal party.

## Run locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. With the live script URL in `config.js`, this behaves like the real site and **RSVPs reach your real sheet**. To try it safely, empty `rsvpEndpoint` in a temporary copy: preview mode uses made-up details and saves replies only in that browser.

## Set up from scratch

### Google Sheet and script

1. Create a blank [Google Sheet](https://sheets.google.com) and keep it private. Copy the ID from its URL.
2. Create a project at [script.google.com](https://script.google.com) and paste in `google-apps-script/Code.gs`.
3. Fill in `SPREADSHEET_ID`, a long random lowercase `INVITE_CODE`, `EVENT_ID`, and `EVENT_DETAILS`.
4. Choose `setupSheet` and click **Run**, then approve Google's prompts. This creates the `RSVPs` tab.
5. Click **Deploy → New deployment → Web app**, with **Execute as: Me** and **Who has access: Anyone**. Guests don't need Google accounts, and your sheet stays private.
6. Copy the URL ending in `/exec` into `rsvpEndpoint` in `config.js`.

### GitHub Pages

1. Create a public repository and push these files to `main`. Free Pages sites are public, which is why the details live elsewhere.
2. Go to **Settings → Pages → Deploy from a branch**, then choose `main` and `/ (root)`.
3. Update the `og:url` and `og:image` tags in `index.html` to match your site, since messaging apps need full URLs for link previews.

If you change `app.js` or `styles.css`, bump the `?v=` number on their tags in `index.html` so a cached page never runs with a mismatched script.

## Troubleshooting

| Problem | Fix |
|---|---|
| Guest is asked for a code | The link is missing `code=`, or the code changed. Resend the full link. |
| "We couldn't open your invitation" | Check the connection and retry. If it persists, check the `/exec` URL and that access is `Anyone`. |
| Details didn't update | Deploy a new version in Apps Script; saving isn't enough. |
| RSVP isn't in the sheet | Check Apps Script **Executions** and that the `RSVPs` tab exists. |
| Countdown is off by an hour | Check the UTC offset in `dateTime` for that date. |
| Music is silent | Tap the music icon and check the phone's silent switch. |
| iPhone doesn't add the event | Open the downloaded `.ics` file, or use the Google Calendar link. |
| Old link preview | Messaging apps cache previews and may take time to refresh. |
