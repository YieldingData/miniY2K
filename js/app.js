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
