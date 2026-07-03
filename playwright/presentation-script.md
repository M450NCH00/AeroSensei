# AeroSensei Demo Presentation Script

Target runtime: about 1 minute 50 seconds.

## 0:00-0:08 - Landing To Live Quality Map

Say:
"AeroSensei begins with a public-facing live air quality map. A citizen or regulator can open it without logging in and immediately inspect regional air quality."

On screen:
- Landing page opens.
- Click `Live Quality Map`.

## 0:08-0:24 - Public Map And NamSach Advisory

Say:
"Here, the bottom-left card guides the user. At first it prompts us to hover or click a district. I search for NamSach, select the area, and the card changes into practical guidance: mask advisory and activity recommendation."

On screen:
- Search `NamSach`.
- Click the located map area.
- Show `Mask Advisory` and `Activity Guidance`.

## 0:24-0:38 - Region Analysis And AI Forecast

Say:
"From the selected area, I open regional analysis. The system shows recent particulate trends, then generates an AI forecast so users can anticipate PM2.5 and PM10 risk before it escalates."

On screen:
- Click `Analyze Region`.
- Show PM chart or no-data state.
- Click `Generate AI Forecast`.
- Show forecast result or unavailable state.

## 0:38-1:02 - Government Dashboard Map

Say:
"Now I switch to the regulator dashboard. After login, the system loads live sensor clusters. We zoom out to see the Vietnam-wide context, then focus into Hanoi, where the active sensor cluster is concentrated."

On screen:
- Click `Launch Dashboard`.
- Log in as government user.
- Dashboard map loads.
- Zoom out to Vietnam overview.
- Zoom back into the Hanoi cluster.

## 1:02-1:20 - Alerts And Notifications

Say:
"For the demo, I force all sensors into a breached state. AeroSensei immediately prepares site-level alerts and government escalation notices, so regulators can see which companies and ambient locations need action."

On screen:
- Open `Alerts`.
- Click `All sensors -> BREACHED`.
- Slowly scroll through company alerts, government ambient alerts, and city-wide escalations.

## 1:20-1:36 - Fines

Say:
"The enforcement workflow turns breach evidence into action. I run today's evaluation, the system records breach alerts, and then we switch to issued fines to show the penalties generated from those violations."

On screen:
- Open `Fines`.
- Click `Evaluate today (demo)`.
- Show `Breach Alerts`.
- Click `Issued Fines`.

## 1:36-1:50 - AI Report Generation

Say:
"Finally, the AI Assistant converts monitoring data into a report. I ask for an air quality report for VinUniversity on July 3, 2026, and the assistant returns the report link for download or review."

On screen:
- Open `AI Assistant`.
- Submit: `Generate air quality report for VinUniversity for 3/7/2026`.
- Show assistant response.
- Open or download the generated report.

## Backup Lines

If forecast data is unavailable:
"For this region, the system has no recent historical data, so it correctly disables forecasting instead of inventing a result."

If the AI report service has no token:
"The assistant workflow is visible here. In a fully provisioned deployment, the same query returns the downloadable report artifact."

If alerts take time:
"The alert screen is refreshing live data from the sensor and AI-agent services, so I am giving it a moment to populate before scrolling through the results."
