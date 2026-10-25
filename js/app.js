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
   SEARCH  (Apple iTunes Search finds the album, MusicBrainz finds the back)
   ------------------------------------------------------------------ */

const ITUNES_URL = "https://itunes.apple.com/search";

// Lowercase, strip accents, and split into plain letter/number words.
function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Backup way of calling iTunes if the browser blocks the normal request.
function itunesJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "itunesCb" + Date.now() + Math.floor(Math.random() * 10000);
    const script = document.createElement("script");

    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("iTunes search timed out"));
    }, 10000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("iTunes search unavailable"));
    };

    script.src = `${url}&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

async function itunesSearch(term) {
  const url =
    `${ITUNES_URL}?term=${encodeURIComponent(term)}` +
    `&entity=album&media=music&limit=25`;

  let data;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    data = await itunesJsonp(url);
  }

  return (data.results || []).filter(
    (item) => item.collectionName && item.artworkUrl100
  );
}

// Tries the full search. If nothing is found, drops the last word and
// tries again, so half-typed words like "ocean a" still work.
async function smartSearch(rawQuery, isCurrent) {
  const words = rawQuery.trim().split(/\s+/).filter(Boolean);

  for (let count = words.length; count >= 1; count--) {
    const term = words.slice(0, count).join(" ");
    const albums = await itunesSearch(term);

    if (!isCurrent()) return [];
    if (albums.length) return albums;
  }

  return [];
}

// iTunes gives a 100px cover. The size is in the URL, so ask for bigger.
function artworkAt(url, size) {
  return url.replace(/\d+x\d+bb/, `${size}x${size}bb`);
}


/* ------------------------------------------------------------------
   BACK COVER LOOKUP
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

// "Ocean Avenue (Deluxe Edition)" -> "Ocean Avenue"
function cleanAlbumTitle(title) {
  return title
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, " ")
    .replace(/\s*-\s*(single|ep)\s*$/i, "")
    .trim();
}

// "Artist feat. Someone" -> "Artist"
function mainArtist(artist) {
  return artist.split(/\s*(?:,|&|\bfeat\.?|\bfeaturing\b|\bwith\b)\s*/i)[0];
}

// One targeted MusicBrainz search for the exact album, then look for a
// back cover in that album's editions.
async function findBackCover(title, artist, isCurrent) {
  const titleTokens = tokenize(cleanAlbumTitle(title));
  const artistTokens = tokenize(mainArtist(artist));

  if (!titleTokens.length || !artistTokens.length) return "";

  const query =
    `releasegroup:(${titleTokens.join(" AND ")}) AND ` +
    `artist:(${artistTokens.join(" AND ")})`;

  const url = new URL("https://musicbrainz.org/ws/2/release-group/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "4");

  let response = await fetch(url);

  if (response.status === 503 || response.status === 429) {
    await wait(2500);
    if (!isCurrent()) return "";
    response = await fetch(url);
  }

  if (!response.ok) return "";

  const data = await response.json();
  if (!isCurrent()) return "";

  const releases = (data["release-groups"] || [])
    .flatMap((group) => group.releases || [])
    .slice(0, 14);

  for (const release of releases) {
    const backUrl = `${CAA}/${release.id}/back-500`;

    if (await imageExists(backUrl)) return backUrl;
    if (!isCurrent()) return "";
  }

  return "";
}


/* ------------------------------------------------------------------
   ALBUM CARDS
   ------------------------------------------------------------------ */

function createAlbumCard(album) {
  const card = document.createElement("article");
  card.className = "album-card";

  const image = document.createElement("img");
  image.alt = `Artwork for ${album.collectionName}`;
  image.loading = "lazy";
  image.src = artworkAt(album.artworkUrl100, 300);

  image.onerror = () => {
    image.style.display = "none";
  };

  const info = document.createElement("div");
  info.className = "album-card-info";

  const title = document.createElement("h3");
  title.textContent = album.collectionName;

  const artist = document.createElement("p");
  artist.textContent = album.artistName || "Unknown artist";

  const year = document.createElement("p");
  year.textContent = album.releaseDate
    ? `Released: ${album.releaseDate.slice(0, 4)}`
    : "Release date unavailable";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.textContent = "Use this album";

  selectButton.addEventListener("click", async () => {
    const thisSelection = ++selectionNumber;
    const isCurrent = () => thisSelection === selectionNumber;

    selectedRelease = album;

    titleInput.value = cleanAlbumTitle(album.collectionName) ||
      album.collectionName;
    artistInput.value = album.artistName || "";

    // Front cover comes straight from iTunes, so it appears immediately.
    autoFront = artworkAt(album.artworkUrl100, 600);
    autoBack = "";
    frontArtwork = autoFront;
    backArtwork = "";
    updatePreview();

    setStatus(
      `Selected "${album.collectionName}". Looking for the back cover... 💿`
    );

    $("label-preview").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    let back = "";

    try {
      back = await findBackCover(
        album.collectionName,
        album.artistName || "",
        isCurrent
      );
    } catch (error) {
      console.error("Back cover lookup failed:", error);
    }

    if (!isCurrent()) return;

    if (back) {
      autoBack = back;
      if (!$("back-upload").value) backArtwork = back;
      updatePreview();

      setStatus(
        `Selected "${album.collectionName}" with front and back artwork. Customize your label below.`
      );
    } else {
      setStatus(
        `Selected "${album.collectionName}". No back cover was found in the archive. ` +
        `You can upload your own back artwork below.`
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
    const albums = await smartSearch(query, isCurrent);

    if (!isCurrent()) return;

    if (!albums.length) {
      setStatus(
        "No matching albums found. Try fewer words, or just the artist name."
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    albums.forEach((album) => {
      fragment.appendChild(createAlbumCard(album));
    });

    results.appendChild(fragment);

    setStatus(
      `Found ${albums.length} ${albums.length === 1 ? "album" : "albums"}. Choose the one you want!`
    );
  } catch (error) {
    if (!isCurrent()) return;

    console.error("Album search failed:", error);

    setStatus(
      `Search failed (${error.message}). Check your connection, turn off ad blockers for this site, and try again.`
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
