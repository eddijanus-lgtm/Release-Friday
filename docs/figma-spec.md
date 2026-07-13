# Figma specification — Release Friday V1

Target file: `Release Friday — Product Design`

Figma file: https://www.figma.com/design/htcO9PgqJzJfFY9pZX356Q

## Pages

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Mobile`

## Foundations

The Figma file contains three local variable collections:

- `Primitives`
- `Semantic`
- `Layout`

### Colors

| Token | Value | Usage |
| --- | --- | --- |
| `color/background` | `#09090B` | App background |
| `color/surface` | `#18181B` | Cards and controls |
| `color/text/primary` | `#FAFAFA` | Primary content |
| `color/text/muted` | `#A1A1AA` | Secondary content |
| `color/accent` | `#A78BFA` | Release metadata |
| `color/accent/soft` | `#C4B5FD` | Upcoming-Friday label |
| `color/border` | `#3F3F46` | Surface outlines |
| `color/accent/secondary` | `#EC4899` | Cover gradient |

### Radius

- `radius/sm`: 12
- `radius/md`: 16
- `radius/lg`: 22
- `radius/pill`: 999

### Spacing

4, 8, 12, 16, 20 and 24 px.

### Typography

- `Display/Hero`: 48/46, Bold
- `Heading/Card`: 18/22, Semi Bold
- `Body/Default`: 16/25, Regular
- `Label/Meta`: 11/14, Semi Bold
- `Label/Navigation`: 11/14, Semi Bold

## Components

### Filter Chip

Figma node: `2:134`

Variants:

- `Active=No`
- `Active=Yes`
- editable `Label` text property

Code mapping: `components/releases/release-feed.tsx`

### Release Card

Figma node: `2:135`

Properties:

- `Meta`
- `Title`
- `Artist`

Layout:

- width: 358 px in the mobile reference
- minimum height: 100 px
- padding: 12 px
- gap: 14 px
- cover: 76 × 76 px
- radius: 22 px

Code mapping: `components/releases/release-card.tsx`

### Bottom Navigation

Figma node: `2:142`

Items:

- Releases
- Suche
- Favoriten
- Settings

Code mapping: `app/page.tsx`

## Mobile home screen

Figma node: `2:155`

Reference frame: `Home / iPhone 16e`, 393 × 852 px.

Order:

1. Upcoming Friday label
2. `Release Friday` heading
3. Product description
4. Country filters
5. Vertical release list
6. Bottom navigation

The screen is assembled from instances of the shared Filter Chip, Release Card and Bottom Navigation components.

## Implementation status

- Foundations created and documented
- 26 local variables created across three collections
- five local text styles created
- reusable components created
- component text properties bound to visible text layers
- mobile home screen assembled and visually verified
- final screenshot verified at native 393 × 852 px
