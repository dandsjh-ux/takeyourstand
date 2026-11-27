# Take Your Stand 🛡️

A multiplayer **Armor of God** dress-up runway game for Sunday school, built with **three.js** and **Socket.io**, designed for portrait phones and tablets.

Teams join on a shared phone or tablet, dress a 3D character in each piece of the Armor of God (Ephesians 6:10–18), answer Bible questions to earn coins and unlock outfits, write a short prayer, and pick their runway walk and poses. Then everyone watches each character walk down a Jerusalem stone walkway, strike their poses and share their prayer in a speech bubble, and votes with stars. Bigger teams' stars count for more, and the teacher's vote counts most.

## How a game runs

1. **Teacher** opens the site and taps **"I'm the teacher — host a game"**. A 4-letter code and a QR code appear. Put this screen on a projector if you have one.
2. **Each team** scans the QR code on its device (or goes to the site and types the code), types its **team name** (there are idea buttons) and picks a Boy or Girl character. In the lobby they design their look: skin tone, hairstyle (boys and girls each have their own cuts), hair colour and eye colour. Boys get tunics and girls get dresses, and each has its own set of sandals; everything else is shared.
   The teacher sets **how many players are in each team** with the 👥 − / + stepper in the Teams tab. That number is the team's star multiplier.
3. The teacher taps **Start styling**. The timer starts (5 minutes by default). Students:
   - work through the tabs: Tunic → **Belt of Truth → Breastplate of Righteousness → Shoes of the Gospel of Peace → Shield of Faith → Helmet of Salvation → Sword of the Spirit** → Bonus → Prayer → Runway. The camera zooms to the body part each tab dresses. Pinch to zoom, drag to turn, double-tap to reset.
   - tap the **🪙 coin button** to answer Bible questions and earn coins
   - spend coins on locked items. Each category has **3 free styles**; everything else, including the bonus wardrobe, walks and most poses, is locked.
   - type a **prayer**, which pops up in a speech bubble on the runway (Ephesians 6:18 replaces a "prayer" armor piece)
   - pick a **runway walk** and up to **5 poses** (or none: tap ✕ or **Clear all poses** to start from blank), then tap **I'm ready**.
4. When time runs out (or the teacher taps **Start runway**), each team's character walks the runway in turn. Everyone else rates them 1–5 ⭐ on their own device. Each vote earns star points (stars × the voter's weight), so a big team's 5★ counts for more than a small team's. The teacher can pause, replay, skip or finish early.
5. **Results:** the top three teams appear on a podium above a full leaderboard. Tap **Play another round** to go again with the same players.

## Host settings

| Tab | What you can set |
|---|---|
| **Teams** | Every device that joined. Set **players per team** (1–30) with the stepper; each row shows how much that team's stars count. You can also rename a team, switch a device to **Teacher (judge)** (votes with extra weight, doesn't walk), give coins, or remove a team |
| **Game** | Styling time, runway seconds per team, coins per correct answer, starting coins, shop price multiplier, **unlock everything** (free-play) |
| **Questions** | Upload a CSV (replace the list or add to it), download a template or the current list, write questions by hand, delete questions, reset to the built-in Armor of God set |
| **Voting** | Weight per player in a team (×1), host weight (×10), **Keep my vote the highest** (on by default), judge weight (×4), full-armor bonus, prayer bonus. A **live table** shows each voter's weight, what their 5★ vote adds and their share of the voting power as teams join |

During styling the **Progress** tab shows each team's armor count, coins, quiz record, ready status and prayer. You can clear an inappropriate prayer there. A basic word filter also runs on names and prayers.

### How scoring works

Scores are **star points**. Every vote adds `stars × the voter's weight`, so a heavier vote pushes a score further instead of just nudging an average:

- A team's weight is `players in the team × weight per player`. A team of 5 giving 5★ adds **25 points**; a team of 1 giving 5★ adds **5 points**.
- The host counts ×10. With **Keep my vote the highest** on, the host's weight is raised to stay just above the biggest team. Helper teachers count ×4.
- Teams can't vote for themselves. To keep that fair, each team's points are scaled by `all voting power ÷ voting power that could vote for it`. Every team can then reach the same top score, and a big team isn't penalised for its own missing vote.
- Bonuses count as extra stars from every voter. By default that's +0.5★ for wearing all six armor pieces and +0.25★ for writing a prayer, each multiplied by the total voting power.

Example: teams of 5, 1, 1 and 1 plus the host (×10) give a total voting power of 18, so the top score is 90 points before bonuses. One small team receives 5★ from the team of 5 and 4★ from the host. That's 25 + 40 = 65 points, scaled by 18 ÷ 17 to **≈ 69 points**. If the 5★ had come from a team of 1 instead, the total would be 5 + 40 = 45, scaled to ≈ 48.

The results list shows each team's points with its average star rating alongside. After voting, each voter sees how many points their vote added. The **Voting** tab's live table shows what a 5★ vote from each voter adds.

## Dropping out and rejoining

Nobody loses their progress if their connection drops. Their look, coins, unlocks, prayer, poses and votes are all kept.

- **Refresh, phone screen lock, Wi-Fi blip:** the game reconnects by itself (a "Reconnecting…" banner shows meanwhile). Anything changed while offline is sent up as soon as the connection is back.
- **Closed the tab or browser:** opening the game link again (the QR code or the address bar) puts the team straight back in its seat. The plain home page also shows a **Rejoin as …** button.
- **Different device or cleared browser:** typing the same team name with the same game code takes back that team's seat, as long as nobody is currently playing in it. A second team with the same name joins as "Name 2".
- **Teacher:** refreshing keeps the host screen. The home page offers **Resume hosting** for the last game.
- **Server restart or crash:** games are saved to disk every couple of seconds and restored when the server starts again, with a short grace period so everyone can reconnect.

## Question CSV format

```csv
question,option_a,option_b,option_c,option_d,answer,coins,reference
What is the belt in the Armor of God called?,Belt of Strength,Belt of Truth,Belt of Joy,Belt of Gold,B,10,Ephesians 6:14
True or false: we should pray on all occasions.,True,False,,,A,,Ephesians 6:18
```

- `answer` can be a letter (A–D), a number (1–4) or the exact text of the right option.
- `coins` (optional) overrides the default coins for that question. `reference` (optional) is shown after answering.
- 2–6 options per question. The answer order is shuffled each time a question is asked, except two-option questions such as True/False.
- **Blooket exports** (`Question Text, Answer 1–4, Correct Answer(s)`) and **"Question, Correct Answer, Incorrect Answer 1–3"** sheets are recognised automatically.

The built-in question set is in [`public/questions-default.csv`](public/questions-default.csv).

## Run it locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. To test on phones on the same Wi-Fi, use your computer's local IP address instead of `localhost`.

## Deploy: GitHub → Render

1. Create a new GitHub repository and push this folder to it (`node_modules` is already ignored).
2. In Render, choose **New → Blueprint** and pick the repository. Render reads [`render.yaml`](render.yaml) and creates a Node web service (`npm ci`, then `npm start`, with a health check at `/healthz`). You can also choose **New → Web Service** and enter those commands yourself.
3. Share your `https://<name>.onrender.com` address. The host screen builds its QR code from that address automatically.

Notes:
- Games are saved to `data/rooms.json` (or `$DATA_DIR/rooms.json`) and restored after a restart, so a crash doesn't end a lesson. Render's normal filesystem is wiped on each **redeploy**, so avoid deploying during class. To keep games across redeploys as well, add a Render persistent disk (paid plans) and set the `DATA_DIR` environment variable to its mount path.
- On Render's **free plan** the service goes to sleep after about 15 minutes without visitors and takes about a minute to wake. **Open the site a few minutes before class.** A paid instance stays awake.
- Keep the service at **one instance**, because games are held by a single server.

## Project layout

```
server.js                 Express + Socket.io game server (rooms, phases, shop, quiz, voting)
render.yaml               Render blueprint
public/
  index.html, css/        App shell and styles (portrait-first, safe-area aware)
  img/items/              Wardrobe icons cropped from the reference sheets
  questions-default.csv   Built-in Armor of God question bank
  js/
    catalog.js            Items, prices, poses, outfit validation (shared with the server)
    scoring.js            Voting weights and scoring (shared with the server)
    csv.js                CSV import (shared with the server)
    character.js          Procedural character rig: body, face, hair
    wardrobe.js           Procedural 3D builders for every wearable item
    textures.js           Canvas-generated fabric, emblem, stone and mosaic textures
    poses.js              Runway walks, poses and the animator
    stage.js              Shared WebGL renderer, viewport insets, item thumbnails
    studio.js             Dress-up scene with category zoom, drag and pinch
    runway.js             Jerusalem runway, presentation timeline and podium
    main.js               Student client and screen routing
    host.js               Teacher dashboard
    ui.js                 DOM helpers and synthesised sound effects
```

All 3D models are built in code; there are no model files to load. Materials use generated textures: linen weave, leather grain, wood grain, hammered metal, braided rope, skin, hair strands and curls, a natural hairline, and iris detail. Characters blink, and sandal straps are shaped to the foot. The wardrobe follows the three reference packs (6 masculine and 6 feminine designs per armor category, plus the biblical bonus wardrobe). Extra designs added for variety include Galilee Fisher and Shepherd tunics, Lydia's purple gown and shawl, a golden cord belt, a Dove of Peace breastplate, Sunrise sandals, an Ichthys shield, a Morning Star helmet, a Scroll of the Word sword, a shepherd's fleece and headscarf, David's lyre, an oil lamp, a dove and Miriam's tambourine. There are also 17 hair styles, 8 skin tones, 7 hair colours, 6 eye colours, 4 walks and 12 poses (up to 5 per runway turn).
