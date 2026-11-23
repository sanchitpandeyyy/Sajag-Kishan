# Krishi Dristi

**Team:** CSITABMC

Krishi Dristi ("agricultural vision") helps Nepali farmers decide what to grow and when, and helps municipal agriculture officers see where land, crops and subsidy need attention.

## The Idea

One system, two sides:

- A **mobile app for farmers** that gives simple, local advice in Nepali.
- A **web dashboard for officers** that shows what is really happening on the land, using satellite data checked against what farmers declare.

## Problem

- Farmers plan from habit and guesswork. Advice rarely fits their altitude, climate or this season's weather.
- Weather and disease warnings often reach farmers too late.
- Officers have little ground truth. They cannot easily tell which registered land is farmed, fallow or abandoned.
- Fertilizer subsidy is shared without solid data. Some farmers in need are missed, and some go to land that is not farmed.

## Solution

**For farmers**

- A crop calendar fitted to their place, altitude and recorded climate, with reminders
- Weather and disease alerts on their phone
- A Nepali assistant they can type or speak to, answering from their own farm data
- Works with weak internet: changes are saved and sent when the connection returns

**For officers**

- A map of registered fields and what is grown on them
- Satellite checks that show each field as cultivated, weak or fallow, season by season
- Real seasonal rainfall and temperature compared with the 10-year normal
- Subsidy planned by need: crop area × recommended dose, shared fairly when stock is short
- A data assistant and an automatic summary that explains the numbers

## How It Works

| Part                         | What it does                                 | Built with                        |
| ---------------------------- | -------------------------------------------- | --------------------------------- |
| [farmer-app](./farmer-app)   | Android app for farmers                      | Expo, React Native                |
| [officer-web](./officer-web) | Dashboard for agriculture officers           | Next.js, React, Tailwind          |
| [backend](./backend)         | APIs, rules engine and scheduled jobs        | Node.js, Hono, Prisma, PostgreSQL |
| [ml](./ml)                   | Land-use model (cultivated or fallow)        | Python                            |
| [docs](./docs)               | Notes on the satellite pipeline and accuracy |                                   |

**Data sources**

- Sentinel-2 satellite imagery (NDVI) via Microsoft Planetary Computer
- ESA WorldCover land cover
- Open-Meteo weather forecast and historical climate
- Google Gemini for voice transcription and the chat assistants
- Farmer declarations and officer records

## Team

| Name            | Role                         |
| --------------- | ---------------------------- |
| Sanchit Pandey  | Full Stack and ML Developer  |
| Nischal Panthi  | App Developer                |
| Nikesh Bhandari | UI/UX and Frontend Developer |
| Rupesh Kharal   | Designer                     |
