
# 💿 miniY2K

### PRINT IT. STICK IT. TAP IT. PLAY IT.

[Try it out](https://example.com)
**Your music. Miniaturized.**

miniY2K is a browser-based label maker for creating miniature album collectibles inspired by the golden age of CD collecting. Combining custom 3D-printed frames, album artwork, and NFC technology, it brings the nostalgia of mini CD jewel cases into the modern era.

Search for an album, customize its wraparound label, print it on sticker paper, and turn it into a tiny physical music collectible.

Think Y2K aesthetics, shiny CDs, Windows XP, MP3 players, and the joy of displaying your favorite albums — just a whole lot smaller. ✨

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🚀 How It Works](#-how-it-works)
- [📐 Label Specifications](#-label-specifications)
- [🖨️ Printing Guide](#️-printing-guide)
- [📱 NFC Integration](#-nfc-integration)
- [🛠️ Technology](#️-technology)
- [🎨 Artwork and Data Sources](#-artwork-and-data-sources)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)

---

## ✨ Features

### 🔎 Album Search and Artwork

Find your favorite albums without manually hunting down every image.

- Search for albums by title or artist.
- Browse matching releases to identify the correct edition.
- Retrieve available album artwork through the MusicBrainz API and Cover Art Archive.
- Select front and back artwork for your label.
- Upload your own images when suitable artwork isn't available.

### 🎨 Automatic Spine Generator

Album spine artwork can be difficult to find. miniY2K provides a customizable alternative.

- Automatically populate the album title and artist.
- Choose serif, sans-serif, or monospaced typography.
- Customize text and background colors.
- Adjust text layout to accommodate narrow spines and longer titles.
- Use custom spine artwork whenever available.

### 🏷️ One-Piece Wraparound Labels

Each label combines three panels into one continuous design.

| Panel | Purpose |
| --- | --- |
| Front | Album cover artwork |
| Spine | Generated title and artist typography, or custom artwork |
| Back | Back-cover artwork or a custom image |

The finished design wraps around a custom 3D-printed frame as a single adhesive label.

**One sticker. Three panels. Zero cutting.**

### 📄 Mixed-Album Print Sheets

Build a collection without wasting sticker paper on duplicate designs.

- Add multiple albums to a print queue.
- Mix different albums, releases, and artwork on one sheet.
- Preview the combined label designs.
- Configure rows, columns, margins, and spacing.
- Export a print-ready PDF formatted for US Letter paper.
- Print at actual size for accurate physical assembly.

### 📐 Print Alignment Controls

Sticker paper and printers don't always align perfectly. Adjustable layout settings help you calibrate your output.

- Configure horizontal and vertical spacing.
- Adjust top and left margins.
- Match the layout to your sticker stock.
- Test alignment on plain paper before printing on adhesive labels.

### 📱 NFC-Ready Collectibles

Each collectible is designed around a custom 3D-printed frame that accommodates a 25 mm NFC puck.

Once programmed with a music link, the NFC tag can launch the associated album or music destination when tapped with a compatible phone.

The label maker handles artwork and print preparation. NFC programming and physical frame fabrication are separate parts of the workflow.

---

## 🚀 How It Works

Turn your favorite albums into miniature physical collectibles in seven steps.

1. **Search** — Find an album by title or artist.
2. **Select** — Choose the correct release and available artwork.
3. **Customize** — Adjust the front, spine, and back panels.
4. **Queue** — Add the finished design to your print sheet.
5. **Export** — Generate a print-ready PDF.
6. **Print and assemble** — Print at 100% scale, peel the label, and wrap it around the 3D-printed frame.
7. **Tap and play** — Program the NFC puck with a music link and enjoy your mini collectible.

**PRINT IT. STICK IT. TAP IT. PLAY IT.**

---

## 🧰 Getting Started

### Using the Browser App

1. Open miniY2K in a supported browser.
2. Search for an album and select a matching release.
3. Choose the front and back artwork.
4. Generate a spine or upload your own image.
5. Preview and customize the complete wraparound label.
6. Add the label to your print queue.
7. Repeat for other albums in your collection.
8. Export the mixed-album PDF.
9. Print at **Actual Size / 100%**.
10. Assemble your labels onto the corresponding 3D-printed frames.

> Availability of individual features depends on the current implementation. See the roadmap for planned improvements.

---

## 📐 Label Specifications

| Component | Specification |
| --- | --- |
| Label width | 2.625 in / 66.675 mm |
| Label height | 1 in / 25.4 mm |
| Paper format | US Letter, 8.5 × 11 in |
| NFC puck | 25 mm diameter |
| Label construction | Single continuous wraparound sticker |
| Frame | Custom 3D-printed design |

The dimensions above describe the **flat sticker**, not the finished miniature case.

The frame geometry must account for the label's front, spine, and back panels, as well as the placement and clearance of the NFC puck. Test the physical dimensions before producing a full collection.

---

## 🖨️ Printing Guide

For the best results, use compatible adhesive label stock and verify alignment before committing to a full sheet.

### Recommended Workflow

1. Use sticker paper compatible with your printer.
2. Export the label sheet as a PDF.
3. Print a test copy on plain paper.
4. Check the label positions against your sticker stock.
5. Disable **Fit to Page**, **Scale to Fit**, and other automatic scaling options.
6. Select **Actual Size** or **100% scale**.
7. Test one label against the 3D-printed frame before printing an entire collection.

### Default Print Dimensions

- **Label size:** 1 × 2.625 inches
- **Page size:** US Letter
- **Layout:** Configurable rows, columns, spacing, and margins

Printer drivers, paper handling, and label stock can introduce small alignment differences. Use the available margin and spacing controls to calibrate your setup.

---

## 📱 NFC Integration

miniY2K is designed to work with NFC-enabled miniature album collectibles.

### How It Works

1. Place a compatible 25 mm NFC puck inside the 3D-printed frame.
2. Program the NFC tag with the album's music URL.
3. Assemble the frame and apply the wraparound label.
4. Tap the collectible with a compatible phone to open the associated music destination.

NFC functionality depends on the tag, phone, operating system, and programmed URL.

**Note:** miniY2K's label-generation workflow does not, by itself, program NFC tags. Tag programming and frame assembly are separate steps.

---

## 🛠️ Technology

miniY2K is designed as a lightweight browser-based application.

| Technology | Purpose |
| --- | --- |
| HTML | Application structure |
| CSS | Styling and responsive layouts |
| JavaScript | Application logic and interactions |
| MusicBrainz Web Service | Album and release metadata |
| Cover Art Archive | Available release artwork |
| HTML Canvas | Artwork composition, cropping, and previews |
| PDF export | Printable sticker sheets |

The goal is to make creating and printing miniature album collectibles accessible without requiring a full desktop publishing application.

---

## 🎨 Artwork and Data Sources

Album metadata can be retrieved from the [MusicBrainz Web Service](https://musicbrainz.org/doc/MusicBrainz_API), with available release artwork provided by the [Cover Art Archive](https://coverartarchive.org/).

Artwork availability varies by release. Some releases may have only a front cover, while others may have additional images. Spine artwork can be particularly difficult to find, making generated typography a useful alternative.

Users are responsible for respecting applicable copyright, licensing, and usage terms. Before distributing or selling finished collectibles, ensure that you have the necessary rights to use the artwork and other protected materials.

---

## 🗺️ Roadmap

The long-term goal is to make building a miniature album collection as easy as building a playlist.

Potential improvements include:

- [ ] Album search and release selection
- [ ] Front and back artwork browsing
- [ ] Automatic spine typography
- [ ] Custom font and color controls
- [ ] Mixed-album print queue
- [ ] Print-ready PDF export
- [ ] Saved projects and persistent collections
- [ ] Drag-and-drop queue ordering
- [ ] Additional label-stock presets
- [ ] Printer alignment calibration
- [ ] Improved artwork cropping and positioning
- [ ] Support for alternate editions and multi-disc releases
- [ ] NFC programming workflow
- [ ] Integration with the 3D-printed frame design

> Roadmap items describe intended development goals and may not yet be implemented. Update this checklist as features become available.

---

## 🤝 Contributing

Have an idea for a better label layout, a new Y2K-inspired design, or a more accurate printing workflow?

Contributions, bug reports, and feature requests are welcome.

Improvements that simplify physical assembly, improve print accuracy, or make the creative process faster are especially appreciated.

When submitting a contribution, please include enough context to reproduce bugs or understand the proposed change.

---

## 📜 License

**No license has been selected yet.**

Until a license is added, the project should not be assumed to be available for unrestricted reuse, modification, or redistribution.

If you intend to distribute miniY2K as an open-source project, choose an appropriate license and add a `LICENSE` file to the repository.

---

<div align="center">

## 💿 miniY2K

**PRINT IT. STICK IT. TAP IT. PLAY IT.**

*Made for music lovers. Inspired by the year 2000.* ✨

</div>
