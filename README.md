# Take Your Stand 🛡️

A multiplayer **Armor of God** dress-up runway game for Sunday school, built with **three.js** and **Socket.io**, designed for portrait phones and tablets.

Students join on their own devices, dress a 3D character in each piece of the Armor of God (Ephesians 6:10–18), answer Bible questions to earn coins and unlock outfits, write a short prayer, and pick their runway walk and poses. Then everyone watches each character walk down a Jerusalem stone walkway, strike their poses and share their prayer in a speech bubble, and votes with stars. The teacher's vote counts most.

## How a game runs

1. **Teacher** opens the site and taps **"I'm the teacher — host a game"**. A 4-letter code and a QR code appear. Put this screen on a projector if you have one.
2. **Students** scan the QR code (or go to the site and type the code), enter a first name and pick Boy or Girl. While waiting in the lobby they can design their look (skin tone, hair style, hair colour) and choose a team.
3. The teacher taps **Start styling**. The timer starts (5 minutes by default). Students:
   - work through the tabs: Tunic → **Belt of Truth → Breastplate of Righteousness → Shoes of the Gospel of Peace → Shield of Faith → Helmet of Salvation → Sword of the Spirit** → Bonus → Prayer → Runway. The camera zooms to the body part each tab dresses. Pinch to zoom, drag to turn, double-tap to reset.
   - tap the **🪙 coin button** to answer Bible questions and earn coins
   - spend coins on locked items. Each category has **3 free styles**; everything else, including the bonus wardrobe, walks and most poses, is locked.
   - type a **prayer**, which pops up in a speech bubble on the runway (Ephesians 6:18 replaces a "prayer" armor piece)
   - pick a **runway walk** and up to **3 poses**, then tap **I'm ready**.
4. When time runs out (or the teacher taps **Start runway**), each student's character walks the runway in turn. Everyone else rates them 1–5 ⭐ on their own device. The teacher can pause, replay, skip or finish early.
5. **Results:** the top three appear on a podium with team standings and a full leaderboard. Tap **Play another round** to go again with the same players.

## Host settings

| Tab | What you can set |
|---|---|
| **Players** | Move students between teams, make a helper a **Teacher (judge)** who votes with extra weight and doesn't walk, give coins, remove a player |
| **Game** | Styling time, runway seconds per student, coins per correct answer, starting coins, shop price multiplier, **unlock everything** (free-play), whether students choose teams or are auto-balanced |
| **Questions** | Upload a CSV (replace the list or add to it), download a template or the current list, write questions by hand, delete questions, reset to the built-in Armor of God set |
| **Voting** | Host weight (default ×5, the highest), judge weight (×3), student weight (×1), **team-size adjustment** (equal power per team / partly balanced / none), how teammate votes count (half / full / none), a per-team multiplier, full-armor bonus, prayer bonus, team score as average or total. A **live table** shows each group's share of the voting power as students join |
| **Teams** | 1–6 teams and their names |

During styling the **Progress** tab shows each student's armor count, coins, quiz record, ready status and prayer. You can clear an inappropriate prayer there. A basic word filter also runs on names and prayers.

### How scoring works

A presenter's score is the **weighted average** of the stars they received, plus bonuses (default: +0.5 for wearing all six armor pieces and +0.25 for writing a prayer).

With *Equal power per team*, a student's weight is `student weight × (average team size ÷ their team size) × team multiplier`. For example, with a team of 3 and a team of 1, each vote from the 1-person team counts ×2 and each vote from the 3-person team counts ×0.67, so both teams have the same total say. Nobody can vote for themselves.

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
- Games are kept in server memory. That keeps things simple (no database), but a redeploy or restart ends any games in progress. Players get sent back to the join screen with a message.
- On Render's **free plan** the service goes to sleep after about 15 minutes without visitors and takes about a minute to wake. **Open the site a few minutes before class.** A paid instance stays awake.
- Keep the service at **one instance**, because rooms live in memory.

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

All 3D models are built in code; there are no model files to load. The wardrobe follows the three reference packs (6 masculine and 6 feminine designs per armor category, plus the biblical bonus wardrobe). Extra designs added for variety include Galilee Fisher and Shepherd tunics, Lydia's purple gown and shawl, a golden cord belt, a Dove of Peace breastplate, Sunrise sandals, an Ichthys shield, a Morning Star helmet, a Scroll of the Word sword, a shepherd's fleece and headscarf, David's lyre, an oil lamp, a dove and Miriam's tambourine. There are also 12 hair styles, 8 skin tones, 7 hair colours, 4 walks and 12 poses.
