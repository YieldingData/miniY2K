const $ = (id) => document.getElementById(id);

const form = $("search-form");
const searchInput = $("album-search");
const searchButton = $("search-button");
const status = $("search-status");
const results = $("search-results");

const titleInput = $("album-title");
const artistInput = $("album-artist");
const spineColor = $("spine-color");
const spineTextColor = $("spine-text-color");
const spineFont = $("spine-font");

const frontPreview = $("front-preview");
const backPreview = $("back-preview");
const frontPlaceholder = $("front-placeholder");
const backPlaceholder = $("back-placeholder");
const spinePreview = $("spine-preview");
const spineTitle = $("spine-title");

const addButton = $("add-label");
const collectionList = $("collection-list");
const collectionCount = $("collection-count");
const printButton = $("print-collection");

let selectedRelease = null;
let frontArtwork = "";
let backArtwork = "";
let autoFront = "";
let autoBack = "";
let searchNumber = 0;
let selectionNumber = 0;

const COLLECTION_STORAGE_KEY = "miniY2K.collection.v1";
const CAA = "https://coverartarchive.org/release";

function loadCollection() {
  try {
    const saved = localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item =>
      item &&
      typeof item.title === "string" &&
      item.title.trim().length > 0
    ).map(item => ({
      title: item.title,
      artist: item.artist || "",
      front: item.front || "",
      back: item.back || "",
      spineColor: item.spineColor || "#17172b",
      spineTextColor: item.spineTextColor || "#ffffff",
      spineFont: item.spineFont || "Arial, sans-serif"
    }));
  } catch (error) {
    console.error("Could not load collection:", error);
    return [];
  }
}

function saveCollection() {
  try {
    localStorage.setItem(
      COLLECTION_STORAGE_KEY,
      JSON.stringify(collection)
    );
    return true;
  } catch (error) {
    console.error("Could not save collection:", error);
    setStatus("Could not save your collection. Browser storage may be full.");
    return false;
  }
}

let collection = loadCollection();


function setStatus(message) {
  status.textContent = message;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


function showArtwork(img, placeholder, url) {
  // If the artwork hasn't changed, leave the image alone.
  // This prevents title/color edits from restarting image loads.
  if (img.dataset.artworkUrl === (url || "")) {
    if (url && img.complete && img.naturalWidth > 0) {
      img.style.display = "block";
      placeholder.style.display = "none";
    }
    return;
  }

  img.dataset.artworkUrl = url || "";
  img.onload = null;
  img.onerror = null;

  img.style.display = "none";
  placeholder.style.display = "grid";

  if (!url) {
    img.removeAttribute("src");
    return;
  }

  img.onload = () => {
    img.style.display = "block";
    placeholder.style.display = "none";
  };

  img.onerror = () => {
    img.style.display = "none";
    placeholder.style.display = "grid";
  };

  img.src = url;
}


function updatePreview() {
  const title = titleInput.value.trim() || "YOUR ALBUM";
  const artist = artistInput.value.trim();

  spineTitle.textContent = artist
    ? `${title} · ${artist}`
    : title;

  spinePreview.style.backgroundColor = spineColor.value;
  spineTitle.style.color = spineTextColor.value;
  spineTitle.style.fontFamily = spineFont.value;

  showArtwork(frontPreview, frontPlaceholder, frontArtwork);
  showArtwork(backPreview, backPlaceholder, backArtwork);

  addButton.disabled = !titleInput.value.trim();
}

function getArtist(release) {
  const credits = release["artist-credit"] || [];

  return credits
    .map((credit) => {
      if (typeof credit === "string") return credit;
      return (credit.name || credit.artist?.name || "") +
        (credit.joinphrase || "");
    })
    .filter(Boolean)
    .join("")
    .trim();
}


/* ------------------------------------------------------------------
   SEARCH
   ------------------------------------------------------------------ */

// Lowercase, strip accents, and split into plain letter/number words.
// This also removes every character that is special in Lucene queries.
function tokenize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Every word must appear in the title OR the artist.
// The final word is treated as a prefix ("ave" finds "avenue").
function buildAnywhereClause(tokens, fuzzy) {
  const last = tokens.length - 1;

  return tokens.map((token, i) => {
    let term = token;
    if (fuzzy) {
      if (token.length > 3) term = `${token}~`;
    } else if (i === last) {
      term = `${token}*`;
    }
    return `(release:${term} OR artist:${term} OR artistname:${term})`;
  }).join(" AND ");
}

// Try every way of splitting the words into "artist" + "album".
// Example: "yellowcard ocean a" -> artist yellowcard, album "ocean a*".
// Example: "yellow card ocean ave" -> artist "yellow card" or "yellowcard".
function buildSplitClauses(tokens) {
  const clauses = [];
  const n = tokens.length;

  const artistExpr = (words, prefixLast) => {
    const withStar = (w, i) =>
      prefixLast && i === words.length - 1 ? `${w}*` : w;

    const spaced = words
      .map((w, i) => `artist:${withStar(w, i)}`)
      .join(" AND ");

    const joined = prefixLast
      ? `artist:${words.join("")}*`
      : `artist:${words.join("")}`;

    return words.length > 1
      ? `((${spaced}) OR ${joined})`
      : `(${spaced})`;
  };

  const releaseExpr = (words, prefixLast) =>
    words
      .map((w, i) =>
        `release:${prefixLast && i === words.length - 1 ? `${w}*` : w}`
      )
      .join(" AND ");

  for (let k = 1; k < n; k++) {
    // Artist first, then album.
    const aFirst = tokens.slice(0, k);
    const rRest = tokens.slice(k);
    clauses.push(
      `(${artistExpr(aFirst, false)} AND ${releaseExpr(rRest, true)})`
    );

    // Album first, then artist.
    const rFirst = tokens.slice(0, n - k);
    const aLast = tokens.slice(n - k);
    clauses.push(
      `(${releaseExpr(rFirst, false)} AND ${artistExpr(aLast, true)})`
    );
  }

  return clauses;
}

function buildMainQuery(tokens) {
  const clauses = [];

  // Exact phrase gets a boost so best matches rise to the top.
  clauses.push(`(release:"${tokens.join(" ")}")^4`);
  clauses.push(`(${buildAnywhereClause(tokens, false)})`);
  clauses.push(...buildSplitClauses(tokens));

  // "yellow card" -> artist "yellowcard"
  if (tokens.length > 1) {
    clauses.push(`(artist:${tokens.join("")}*)`);
  }

  return clauses.join(" OR ");
}

async function musicBrainzSearch(query) {
  const url = new URL("https://musicbrainz.org/ws/2/release/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "60");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`MusicBrainz returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.releases || [];
}

// Tries a strict search first, then looser ones until something is found.
async function smartSearch(rawQuery, isCurrent) {
  const tokens = tokenize(rawQuery);
  if (!tokens.length) return [];

  const main = buildMainQuery(tokens);

  const attempts = [
    `(${main}) AND status:official AND primarytype:album`,
    `(${main}) AND status:official`,
    main,
    buildAnywhereClause(tokens, true)
  ];

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) {
      // MusicBrainz asks for no more than about 1 request per second.
      await wait(1100);
      if (!isCurrent()) return [];
    }

    const releases = await musicBrainzSearch(attempts[i]);
    if (!isCurrent()) return [];

    if (releases.length) return releases;
  }

  return [];
}

function normalizeKey(text) {
  return tokenize(text || "").join(" ");
}

// Merges many editions of the same album into one entry.
// The other editions are kept so we can look for artwork in them.
function groupReleases(releases) {
  const groups = new Map();

  releases.forEach((release) => {
    const key =
      normalizeKey(release.title) + "|" + normalizeKey(getArtist(release));

    if (!groups.has(key)) {
      groups.set(key, { release, editions: [] });
    }

    groups.get(key).editions.push(release);
  });

  return Array.from(groups.values());
}


/* ------------------------------------------------------------------
   ARTWORK LOOKUP
   ------------------------------------------------------------------ */

// Checks whether an image URL really exists by trying to load it.
function imageExists(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const probe = new Image();
    const timer = setTimeout(() => {
      probe.onload = probe.onerror = null;
      resolve(false);
    }, timeoutMs);

    probe.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };

    probe.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    probe.src = url;
  });
}

// Goes through the editions one by one until one has the requested image.
// kind is "front" or "back".
async function findArtwork(editions, kind, isCurrent) {
  const limit = Math.min(editions.length, 8);

  for (let i = 0; i < limit; i++) {
    const url = `${CAA}/${editions[i].id}/${kind}-500`;

    if (await imageExists(url)) return url;
    if (!isCurrent()) return "";
  }

  return "";
}


/* ------------------------------------------------------------------
   ALBUM CARDS
   ------------------------------------------------------------------ */

function createAlbumCard(group) {
  const editions = group.editions;
  const release = group.release;

  // The edition whose cover is currently showing on the card.
  let shownEdition = 0;

  const card = document.createElement("article");
  card.className = "album-card";

  const image = document.createElement("img");
  image.alt = `Artwork for ${release.title}`;
  image.loading = "lazy";

  // If this edition has no cover, quietly try the next edition.
  image.onerror = () => {
    shownEdition++;

    if (shownEdition < Math.min(editions.length, 5)) {
      image.src = `${CAA}/${editions[shownEdition].id}/front-250`;
    } else {
      image.style.display = "none";
    }
  };

  image.src = `${CAA}/${editions[0].id}/front-250`;

  const info = document.createElement("div");
  info.className = "album-card-info";

  const title = document.createElement("h3");
  title.textContent = release.title || "Untitled release";

  const artist = document.createElement("p");
  artist.textContent = getArtist(release) || "Unknown artist";

  const year = document.createElement("p");
  const dated = editions
    .map((e) => (e.date || "").slice(0, 4))
    .filter(Boolean)
    .sort()[0];

  year.textContent = dated
    ? `Released: ${dated}`
    : "Release date unavailable";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.textContent = "Use this album";

  selectButton.addEventListener("click", async () => {
    const thisSelection = ++selectionNumber;
    const isCurrent = () => thisSelection === selectionNumber;

    selectedRelease = release;

    titleInput.value = release.title || "";
    artistInput.value = getArtist(release);

    // Try the edition showing on the card first, then the others.
    const ordered = [
      editions[Math.min(shownEdition, editions.length - 1)],
      ...editions.filter((_, i) => i !== shownEdition)
    ];

    // Show something right away while we search for better artwork.
    autoFront = `${CAA}/${ordered[0].id}/front-250`;
    autoBack = "";
    frontArtwork = autoFront;
    backArtwork = "";
    updatePreview();

    setStatus(`Selected "${release.title}". Looking for front and back artwork... 💿`);

    $("label-preview").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    const [front, back] = await Promise.all([
      findArtwork(ordered, "front", isCurrent),
      findArtwork(ordered, "back", isCurrent)
    ]);

    if (!isCurrent()) return;

    if (front) {
      autoFront = front;
      // Don't overwrite artwork the user uploaded in the meantime.
      if (!$("front-upload").value) frontArtwork = front;
    }

    if (back) {
      autoBack = back;
      if (!$("back-upload").value) backArtwork = back;
    }

    updatePreview();

    if (back) {
      setStatus(`Selected "${release.title}" with front and back artwork. Customize your label below.`);
    } else {
      setStatus(
        `Selected "${release.title}". No back cover was found in the archive for this album — ` +
        `you can upload your own back artwork below.`
      );
    }
  });

  info.append(title, artist, year, selectButton);
  card.append(image, info);

  return card;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();
  if (!query) return;

  const thisSearch = ++searchNumber;
  const isCurrent = () => thisSearch === searchNumber;

  searchButton.disabled = true;
  searchButton.textContent = "Searching...";
  results.replaceChildren();

  setStatus("Looking through the record collection... 💿");

  try {
    const releases = await smartSearch(query, isCurrent);

    if (!isCurrent()) return;

    if (!releases.length) {
      setStatus(
        "No matching releases found. Try fewer words, or just the artist name."
      );
      return;
    }

    const groups = groupReleases(releases).slice(0, 18);
    const fragment = document.createDocumentFragment();

    groups.forEach((group) => {
      fragment.appendChild(createAlbumCard(group));
    });

    results.appendChild(fragment);

    setStatus(
      `Found ${groups.length} ${groups.length === 1 ? "album" : "albums"}. Choose the one you want!`
    );
  } catch (error) {
    if (!isCurrent()) return;

    console.error("Album search failed:", error);

    setStatus(
      "Search failed. Check your internet connection and try again. " +
      "If the service is temporarily unavailable or rate-limited, wait a little before retrying."
    );
  } finally {
    if (isCurrent()) {
      searchButton.disabled = false;
      searchButton.textContent = "Search!";
    }
  }
});

function loadCustomImage(file, callback) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose an image file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    callback(reader.result);
    updatePreview();
    setStatus("Custom artwork loaded!");
  };

  reader.onerror = () => {
    setStatus("Couldn't read that image. Try another file.");
  };

  reader.readAsDataURL(file);
}

$("front-upload").addEventListener("change", (event) => {
  loadCustomImage(event.target.files[0], (image) => {
    frontArtwork = image;
  });
});

$("back-upload").addEventListener("change", (event) => {
  loadCustomImage(event.target.files[0], (image) => {
    backArtwork = image;
  });
});

$("reset-art").addEventListener("click", () => {
  // Go back to the artwork found automatically for the selected album.
  frontArtwork = autoFront;
  backArtwork = autoBack;

  $("front-upload").value = "";
  $("back-upload").value = "";

  updatePreview();
  setStatus("Custom artwork cleared.");
});

[titleInput, artistInput, spineColor, spineTextColor, spineFont]
  .forEach((control) => {
    control.addEventListener("input", updatePreview);
    control.addEventListener("change", updatePreview);
  });

function makeCollectionItem(item, index) {
  const card = document.createElement("article");
  card.className = "collection-item";

  const image = document.createElement("img");
  image.alt = item.title;
  image.loading = "lazy";
  image.src = item.front || "";

  image.onerror = () => {
    image.style.display = "none";
  };

  const title = document.createElement("h3");
  title.textContent = item.title;

  const artist = document.createElement("p");
  artist.textContent = item.artist || "Unknown artist";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Remove";

  remove.addEventListener("click", () => {
    collection.splice(index, 1);
    renderCollection();
    saveCollection();
  });

  card.append(image, title, artist, remove);

  return card;
}

function renderCollection() {
  collectionCount.textContent =
    `${collection.length} ${collection.length === 1 ? "album" : "albums"}`;

  printButton.disabled = collection.length === 0;
  collectionList.replaceChildren();

  if (!collection.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("span");
    icon.textContent = "💿";

    const message = document.createElement("p");
    message.textContent = "Your collection is waiting to happen.";

    const hint = document.createElement("small");
    hint.textContent = "Search for an album and add your first label!";

    empty.append(icon, message, hint);
    collectionList.appendChild(empty);
    return;
  }

  collection.forEach((item, index) => {
    collectionList.appendChild(makeCollectionItem(item, index));
  });
}

addButton.addEventListener("click", () => {
  const title = titleInput.value.trim();
  if (!title) return;

  collection.push({
    title,
    artist: artistInput.value.trim(),
    front: frontArtwork,
    back: backArtwork,
    spineColor: spineColor.value,
    spineTextColor: spineTextColor.value,
    spineFont: spineFont.value
  });

  renderCollection();

  if (saveCollection()) {
    setStatus(`"${title}" added to your mini collection! ✨`);
  }
});


function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function printableLabel(item) {
  const front = item.front
    ? `<img src="${escapeHTML(item.front)}" alt="">`
    : "";

  const back = item.back
    ? `<img src="${escapeHTML(item.back)}" alt="">`
    : "";

  const spine = escapeHTML(`${item.title} · ${item.artist || ""}`);

  return `
    <div class="label">
      <div class="panel artwork">${front}</div>
      <div class="panel spine"
        style="background:${escapeHTML(item.spineColor)};
               color:${escapeHTML(item.spineTextColor)};
               font-family:${escapeHTML(item.spineFont)}">
        <span>${spine}</span>
      </div>
      <div class="panel artwork">${back}</div>
    </div>
  `;
}

printButton.addEventListener("click", () => {
  if (!collection.length) return;

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    setStatus(
      "Your browser blocked the print window. Allow pop-ups for this site and try again."
    );
    return;
  }

  const labels = collection.map(printableLabel).join("");

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>miniY2K Print Sheet</title>
      <style>
        @page {
          size: letter portrait;
          margin: 0.5in;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: Arial, sans-serif;
        }

        .instructions {
          margin: 0 0 20px;
          font-size: 12px;
          line-height: 1.5;
        }

        .sheet {
          display: grid;
          grid-template-columns: repeat(2, 2.625in);
          gap: 0.15in;
          align-items: start;
        }

        .label {
          display: grid;
          grid-template-columns: 1fr 0.24fr 1fr;
          width: 2.625in;
          height: 1in;
          overflow: hidden;
          border: 0.3pt solid #aaa;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .panel {
          position: relative;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .artwork {
          background: #eee;
        }

        .artwork img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .spine {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          font-size: 6pt;
          font-weight: bold;
          text-align: center;
          overflow-wrap: anywhere;
          writing-mode: vertical-rl;
          transform: none;
        }

        .spine span {
          transform: rotate(180deg);
        }

        @media print {
          .instructions { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="instructions">
        miniY2K print sheet — select Actual Size / 100% in your print
        dialog. Verify alignment on plain paper before using sticker stock.
        This prototype does not yet calibrate sticker-sheet margins.
      </div>
      <main class="sheet">${labels}</main>
      <script>
        window.onload = () => {
          const images = Array.from(document.images);
          Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })).then(() => {
            window.focus();
            window.print();
          });
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
});

updatePreview();
renderCollection();
