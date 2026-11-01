# Device QA checklist

Run this on a real device against the staging URL before launch. Add `?debug=1` to `/play` to see FPS, hitboxes, seed and tick.

## Devices

| Device or browser        | What it stands for                                      |
| ------------------------ | ------------------------------------------------------- |
| Budget Android, Chrome   | 2-3 GB RAM, for example Redmi 9A or Samsung Galaxy A04  |
| iPhone SE, Safari        | Small screen with no notch. Original SE stops at iOS 15 |
| Notched iPhone, Safari   | Safe areas                                              |
| Instagram in-app browser | Open the link from a DM, on Android and on iPhone       |
| WhatsApp in-app browser  | Open the link from a chat, on Android and on iPhone     |

## Every device

**Load**

- [ ] Landing page loads in under 3 s on throttled 4G.
- [ ] Game shows its progress bar and is ready in under 3 s.
- [ ] Link preview shows title, tagline and image when the link is pasted in WhatsApp.

**Layout**

- [ ] HUD, bow and Let's Play clear the notch, the home bar and the browser toolbar.
- [ ] Landscape shows "Rotate your phone", and portrait restores the game.
- [ ] All buttons are easy to tap, at least 44 px tall.

**Input lock on /play**

- [ ] Dragging up or down never scrolls the page or pulls to refresh.
- [ ] Two-finger pinch and double-tap never zoom.
- [ ] Long press shows no menu and selects no text.
- [ ] Terms and Privacy still scroll and zoom normally.

**Audio**

- [ ] Sound plays after tapping Let's Play.
- [ ] Reloading on /play gives sound after the first drag.
- [ ] Speaker toggle works and is remembered after a reload.
- [ ] Round is fully playable with the phone on silent.

**App switch**

- [ ] Away under 3 s with a finger down: game continues and the next drag fires.
- [ ] Away over 3 s: game pauses, then resumes with a 3-second countdown.
- [ ] Sound returns after the switch, on iPhone especially.
- [ ] Timer lost no time while away.
- [ ] Incoming call during a round behaves the same way.

**Slow network** (Chrome DevTools remote, or a poor signal)

- [ ] Airplane mode at the last arrow: tally keeps retrying for up to 50 s, then shows Try again.
- [ ] Network back, Try again: result appears and no second attempt is used.
- [ ] Winning round with the reply lost: player still lands on the win page.

**Performance**

- [ ] `?debug=1` holds 55+ fps for a full round.
- [ ] Phone stays usable after 10 rounds in a row, with no reload needed.

## Share

- [ ] Share opens the system sheet, or copies the link with a toast where sharing is missing.
- [ ] Story card downloads. Instagram's in-app browser often blocks downloads, so note the result.
- [ ] Book tickets opens the booking page with UTM tags.

## Login

- [ ] Real OTP SMS arrives within 30 s on an Indian number.
- [ ] Android offers SMS autofill, or the OTP can be typed by hand.
- [ ] A `?token=` link skips login and removes the token from the address bar.
