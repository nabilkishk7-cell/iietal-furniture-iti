# Joud Inventory

Build an Arabic, RTL web app to manage furniture custody/inventory. Use ITI visual identity (colors and logo) and take visual inspiration from https://summit-link-creator.lovable.app/. The source spreadsheet is https://docs.google.com/spreadsheets/d/1rnxlmHS1hgBYB70AeE1HLwAgQYDwByZR/edit?usp=sharing&ouid=102225761059400927305&rtpof=true&sd=true . Import and preserve its existing data structure and functionality where accessible. The app needs: Dashboard with all relevant spreadsheet statistics; a Custody Distribution page that follows the existing sheet closely; a Custody Movements page as the authoritative place to edit transfers (from location to location), updating distribution totals and all dependent views; a single combined Search page with search/filter by location and by item, showing all items at a selected location or total quantity and all locations for a selected item; roles: Admin full permissions, Reviewer can view all pages read-only, User can access only Custody Movements and edit it. Build robust linked data behavior and clear Arabic labels. If the Google Sheet cannot be read due to access permissions, create a complete app with import capability and clearly note exactly what access/input is needed to populate it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iietal-furniture-iti.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8f653830-12dc-4ac1-b6d0-173053175421).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
