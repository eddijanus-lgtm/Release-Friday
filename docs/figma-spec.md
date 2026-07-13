# Figma specification — Release Friday V1

Target file: `Release Friday — Product Design`

## Pages

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Mobile`
5. `04 Flows`

## Foundations

### Colors

| Token | Value | Usage |
| --- | --- | --- |
| `color/bg` | `#09090B` | App background |
| `color/surface` | `rgba(24,24,27,.82)` | Cards and controls |
| `color/text` | `#FAFAFA` | Primary content |
| `color/muted` | `#A1A1AA` | Secondary content |
| `color/accent` | `#A78BFA` | Date and release metadata |
| `color/border` | `rgba(255,255,255,.10)` | Surface outlines |

### Radius

- `radius/sm`: 12
- `radius/md`: 16
- `radius/lg`: 22
- `radius/pill`: 999

### Spacing

4, 8, 12, 16, 20, 24, 32, 40.

### Typography

System stack led by Inter.

- Display: 48/46, Extra Bold
- Title: 18/24, Bold
- Body: 16/24, Regular
- Label: 12/16, Extra Bold, uppercase where appropriate
- Navigation: 13/18, Bold

## Components

### Filter Chip

Variants:

- State: default, selected
- Country: all, DE, US
- Minimum height: 42
- Focus ring: 2 px accent with 3 px offset

### Release Card

Properties:

- Artist
- Title
- Country
- Release kind
- Cover initials or image
- Details action

Layout:

- Mobile width: fill container
- Minimum height: 100
- Padding: 12
- Gap: 14
- Cover: 76 × 76
- Radius: 22

### Bottom Navigation

Items:

- Releases
- Favoriten
- Settings

Variants:

- Active item
- Inactive item
- Safe-area-aware mobile container

## Mobile home screen

Frame: iPhone 16/17 class width, 393 px.

Order:

1. Upcoming Friday date
2. `Release Friday` heading
3. Short product description
4. Horizontal country filters
5. Vertical release list
6. Fixed bottom navigation

## Code mapping

| Figma component | Code |
| --- | --- |
| `Filter Chip` | `components/releases/release-feed.tsx` |
| `Release Card` | `components/releases/release-card.tsx` |
| `Bottom Navigation` | `app/page.tsx` |
| Foundations | `app/globals.css` |

## Current blocker

The Figma file exists, but the connected Starter plan returned an MCP tool-call limit before canvas nodes could be created. This specification is the exact source for the next Figma write operation once tool access is available.
