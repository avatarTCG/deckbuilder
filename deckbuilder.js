// ============================================================
// Configuration
// ============================================================

const CARD_DATA_URL = "data/cards.json";
const CHAMBER_DATA_URL = "data/characters.json";

const CARD_IMAGE_PATH = "images/cards/";
const CHAMBER_IMAGE_PATH = "images/chambers/"

const MAX_COPIES = 4;
const MIN_DECK_SIZE = 60;

const STORAGE_KEY = "card-game-deck";
const SELECTED_CHARACTER_KEY = "selected-character";


// ============================================================
// Application state
// ============================================================

let cards = {};
let chambers = {};

let selectedChamberCharacter = null;

let deck = {
    chamber: null,
    cards: {}
};


// ============================================================
// Initialization
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();

    const selectedCharacter = localStorage.getItem(SELECTED_CHARACTER_KEY);
    if (!selectedCharacter) {
        window.location.href = "index.html";
        return;
    }

    selectedChamberCharacter = selectedCharacter;
    loadSavedDeck();

    try {
        await loadCardData();
        await loadChamberData();

        if (!chambers[selectedChamberCharacter]) {
            localStorage.removeItem(SELECTED_CHARACTER_KEY);
            window.location.href = "index.html";
            return;
        }

        if (deck.chamber && deck.chamber.character !== selectedChamberCharacter) {
            deck.chamber = null;
            saveDeckToStorage();
        }

        initializeCardFilters();
        renderChambers();
        renderCards();
        renderDeck();
    } catch (error) {
        console.error(error);
        document.getElementById("available-cards").innerHTML = "<p>Unable to load card data.</p>";
    }
});


// ============================================================
// Load data
// ============================================================

async function loadCardData() {
    const response = await fetch(CARD_DATA_URL);
    if (!response.ok) {
        throw new Error("Unable to load cards.json");
    }

    cards = await response.json();
    console.log("Loaded cards:", Object.keys(cards).length);
}


async function loadChamberData() {
    const response = await fetch(CHAMBER_DATA_URL);
    if (!response.ok) {
        throw new Error("Unable to load chambers.json");
    }

    chambers = await response.json();
    console.log(
        "Loaded chambers:",
        Object.keys(chambers).length
    );
}


// ============================================================
// Event listeners
// ============================================================

function setupEventListeners() {

}


// ============================================================
// Filters
// ============================================================

const FILTER_TYPES = ["STRIKE", "ADVANTAGE", "ALLY"];

let selectedTypes = new Set(FILTER_TYPES);
let selectedTraits = new Set();


function initializeCardFilters() {
    selectedTypes = new Set(FILTER_TYPES);
    selectedTraits = new Set();

    const traitContainer = document.getElementById("trait-filters");
    if (!traitContainer) {
        return;
    }

    traitContainer.innerHTML = "";

    const character = chambers[selectedChamberCharacter];
    if (!character || !Array.isArray(character.traits)) {
        return;
    }

    const traits = new Set(character.traits);

    // NONE is always legal for the character.
    traits.add("NONE");

    // Include ZENEMENTAL only when this character has character-specific
    // ZENEMENTAL cards in the card pool.
    const hasZenementalCards = Object.values(cards).some(card =>
        card.trait === "ZENEMENTAL" &&
        card.character === character.character
    );

    if (hasZenementalCards) {
        traits.add("ZENEMENTAL");
    }

    [...traits]
        .sort()
        .forEach(trait => {
            selectedTraits.add(trait);

            const label = document.createElement("label");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "card-trait";
            checkbox.value = trait;
            checkbox.checked = true;

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selectedTraits.add(trait);
                } else {
                    selectedTraits.delete(trait);
                }

                applyCardFilters();
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${trait}`));

            traitContainer.appendChild(label);
        });

    document
        .querySelectorAll('input[name="card-type"]')
        .forEach(checkbox => {
            checkbox.checked = true;

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selectedTypes.add(checkbox.value);
                } else {
                    selectedTypes.delete(checkbox.value);
                }

                applyCardFilters();
            });
        });
}


function isCardVisible(card) {
    if (!isCardAllowedForCharacter(card)) {
        return false;
    }

    if (!selectedTypes.has(card.type)) {
        return false;
    }

    if (!selectedTraits.has(card.trait)) {
        return false;
    }

    return true;
}


// ============================================================
// Card browser
// ============================================================

function renderCards() {
    const grid = document.getElementById("available-cards");

    grid.classList.remove("chamber-grid");
    grid.innerHTML = "";

    const typeOrder = ["STRIKE", "ADVANTAGE", "ALLY"];
    Object.entries(cards)
        .filter(([, card]) => isCardVisible(card))
        .sort(([, cardA], [, cardB]) =>
            typeOrder.indexOf(cardA.type) - typeOrder.indexOf(cardB.type) ||
            cardA.name.localeCompare(cardB.name)
        )
        .forEach(([id, card]) => {
            const element = createCardElement(id, card);
            grid.appendChild(element);
        });

    if (grid.children.length === 0) {
        grid.innerHTML = "<p>No cards available.</p>";
    }
}

function updateCardQuantity(cardId) {
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);

    if (!cardElement) {
        return;
    }

    const quantity = deck.cards[cardId] || 0;
    const badge = cardElement.querySelector(".card-quantity");

    if (badge) {
        if(quantity > 0) {
            badge.textContent = quantity;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    }
}

function createCardElement(id, card) {
    const container = document.createElement("div");
    container.className = "card";
    container.title = card.name;
    container.dataset.cardId = id;

    const image = document.createElement("img");
    image.src = `${CARD_IMAGE_PATH}${id}.png`;
    image.alt = card.name;
    image.loading = "lazy";

    image.onerror = () => {
        image.alt = `${card.name} - image not found`;
    };

    container.appendChild(image);

    const quantity = deck.cards[id] || 0;
    if (quantity > 0) {
        const quantityElement = document.createElement("div");
        quantityElement.className = "card-quantity";
        quantityElement.textContent = quantity;

        container.appendChild(quantityElement);
    }

    container.addEventListener("click", (event) => {
        event.preventDefault();
        addCardToDeck(id);
    });

    return container;
}

function isCardAllowedForCharacter(card) {
    const character = chambers[selectedChamberCharacter];
    if (!character || !Array.isArray(character.traits)) {
        return false;
    }

    if (card.trait === "NONE") {
        return true;
    }

    if (card.trait === "ZENEMENTAL") {
        return card.character === character.character;
    }

    return character.traits.includes(card.trait);
}

function applyCardFilters() {
    const grid = document.getElementById("available-cards");

    Array.from(grid.children).forEach(element => {
        const cardId = element.dataset.cardId;
        const card = cards[cardId];

        element.style.display = isCardVisible(card) ? "" : "none";
    });
}

// ============================================================
// Deck manipulation
// ============================================================

function addCardToDeck(cardId) {
    const card = cards[cardId];
    if (!card || !isCardAllowedForCharacter(card)) {
        return;
    }

    const currentQuantity = deck.cards[cardId] || 0;

    if (currentQuantity >= MAX_COPIES) {
        deck.cards[cardId] = MAX_COPIES;
    } else {
        deck.cards[cardId] = currentQuantity + 1;
    }

    renderDeck();
    updateCardQuantity(cardId);
    saveDeckToStorage();
}


function removeCardFromDeck(cardId) {
    const currentQuantity = deck.cards[cardId] || 0;

    if (currentQuantity <= 1) {
        delete deck.cards[cardId];
    } else {
        deck.cards[cardId] = currentQuantity - 1;
    }

    renderDeck();
    updateCardQuantity(cardId);
    saveDeckToStorage();
}


// ============================================================
// Deck rendering
// ============================================================

function renderDeck() {
    renderDeckCardCount();
    renderDeckCardList();
    renderSelectedChamber();
}


function getDeckSize() {
    return Object.values(deck.cards)
        .reduce((total, quantity) => total + quantity, 0);
}


function renderDeckCardCount() {
    const count = getDeckSize();
    document.getElementById("deck-card-count").textContent = `${count}`;
}

function renderDeckCardList() {
    const element = document.getElementById("deck-cards");
    element.innerHTML = "";

    const cardIds = Object.keys(deck.cards);

    if (cardIds.length === 0) {
        element.innerHTML = "<p>Your deck is empty.</p>";
        return;
    }

    cardIds
        .forEach(cardId => {
            const card = cards[cardId];
            if (!card) {
                return;
            }

            const row = document.createElement("div");
            row.className = "deck-card";

            const image = document.createElement("img");
            image.src = `images/cards/${cardId}.png`;
            image.alt = card.name;

            addCardHoverPreview(image);

            const controls = document.createElement("div");
            controls.className = "quantity-controls";

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            if (deck.cards[cardId] === 1) {
                //Trash can icon
                removeButton.innerHTML = `
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 7h14M10 4h4l1 3H9l1-3zM7 7l1 13h8l1-13M10 10v7M14 10v7"/>
                    </svg>
                `;
            } else {
                removeButton.textContent = "−";
            }
            removeButton.addEventListener(
                "click",
                () => removeCardFromDeck(cardId)
            );


            const quantity = document.createElement("span");
            quantity.textContent = deck.cards[cardId];

            const addWrapper = document.createElement("span");
            addWrapper.className = "deck-card-add-wrapper";

            const addButton = document.createElement("button");
            addButton.textContent = "+";
            addButton.type = "button";
            addButton.disabled = deck.cards[cardId] >= MAX_COPIES;

            addButton.addEventListener("click", () => addCardToDeck(cardId));
            addWrapper.appendChild(addButton);

            controls.appendChild(removeButton);
            controls.appendChild(quantity);
            controls.appendChild(addWrapper);

            row.appendChild(image);
            row.appendChild(controls);

            element.appendChild(row);
        });
}


// ============================================================
// Chambers
// ============================================================

function renderChambers() {
    renderSelectedChamber();

    const heading = document.querySelector(".available-panel h2");
    const grid = document.getElementById("available-cards");

    if (!deck.chamber) {
        heading.textContent = "Available Chambers";
        renderAvailableChambers(grid);
    } else {
        heading.textContent = "Available Cards";
        renderCards();
    }
}

function renderAvailableChambers(element) {
    element.innerHTML = "";
    element.classList.add("chamber-grid");

    const character = chambers[selectedChamberCharacter];
    if (!character || !character.chambers) {
        element.innerHTML = "<p>No chambers available.</p>";
        return;
    }

    Object.keys(character.chambers).sort().forEach(chamberId => {
        const choice = document.createElement("div");
        choice.className = "chamber-choice";

        if (deck.chamber && deck.chamber.id === chamberId) {
            choice.classList.add("selected");
        }

        choice.title = `${character.name} - ${chamberId}`;
        choice.appendChild(createChamberPreview(selectedChamberCharacter, chamberId, "front"));

        const label = document.createElement("div");
        label.textContent = chamberId;
        choice.appendChild(label);

        choice.addEventListener("click", () => selectChamber(selectedChamberCharacter, chamberId));
        element.appendChild(choice);
    });
}

function createChamberPreview(characterKey, chamberId, side = "front") {
    const chamber = chambers[characterKey].chambers[chamberId];
    const container = document.createElement("div");
    container.className = "mini-chamber";

    const top = document.createElement("img");
    const bottom = document.createElement("img");

    if (side === "front") {
        top.src = `${CHAMBER_IMAGE_PATH}${characterKey}/${chamber.front}.png`;
        bottom.src = `${CHAMBER_IMAGE_PATH}${characterKey}/Front.png`;
    } else {
        top.src = `${CHAMBER_IMAGE_PATH}${characterKey}/${chamber.back}.png`;
        bottom.src = `${CHAMBER_IMAGE_PATH}${characterKey}/Back.png`;
    }

    top.alt = chamber[side];
    bottom.alt = side === "front" ? characterKey : `${characterKey} back`;

    container.appendChild(top);
    container.appendChild(bottom);
    return container;
}

function selectChamber(chamberId) {
    deck.chamber = {
        id: chamberId,
        character: selectedChamberCharacter
    };

    saveDeckToStorage();

    renderSelectedChamber();
    renderCards();
}

function renderSelectedChamber() {
    const element = document.getElementById("selected-chamber");
    element.innerHTML = "";

    const character = chambers[selectedChamberCharacter];
    if (!character) {
        return;
    }

    const title = document.createElement("h3");
    title.textContent = character.name;
    element.appendChild(title);

    const preview = document.createElement("div");
    preview.className = "chamber-preview";

    preview.appendChild(createClickableChamberImage(
        `${CHAMBER_IMAGE_PATH}${selectedChamberCharacter}/Front.png`,
        character.name
    ));

    if (deck.chamber) {
        const chamberCard = character.chambers[deck.chamber.id];

        if (chamberCard) {
            preview.appendChild(createClickableChamberImage(
                `${CHAMBER_IMAGE_PATH}${selectedChamberCharacter}/${chamberCard.front}.png`,
                chamberCard.front
            ));

            preview.appendChild(createClickableChamberImage(
                `${CHAMBER_IMAGE_PATH}${selectedChamberCharacter}/${chamberCard.back}.png`,
                chamberCard.back
            ));
        }
    }

    element.appendChild(preview);
}

function createClickableChamberImage(src, alt) {
    const container = document.createElement("div");
    container.className = "chamber-side";

    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    image.classList.add("clickable");

    image.addEventListener("click", showAvailableChambers);

    container.appendChild(image);
    return container;
}

function showAvailableChambers() {
    const heading = document.querySelector(".available-panel h2");
    const grid = document.getElementById("available-cards");
    grid.classList.add("chamber-grid");

    heading.textContent = "Available Chambers";
    grid.innerHTML = "";

    const character = chambers[selectedChamberCharacter];

    if (!character || !character.chambers) {
        grid.innerHTML = "<p>No chambers available.</p>";
        return;
    }

    Object.entries(character.chambers)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([id, chamber]) => {
            const element = createChamberChoice(
                selectedChamberCharacter,
                id,
                chamber
            );

        grid.appendChild(element);
    });
}

function createChamberChoice(characterKey, id, chamber) {
    const element = document.createElement("div");
    element.className = "chamber-choice";

    if (deck.chamber?.id === id) {
        element.classList.add("selected");
    }

    const front = document.createElement("img");
    front.src = `${CHAMBER_IMAGE_PATH}${characterKey}/${chamber.front}.png`;

    const back = document.createElement("img");
    back.src = `${CHAMBER_IMAGE_PATH}${characterKey}/${chamber.back}.png`;

    const label = document.createElement("div");
    label.textContent = id;

    element.appendChild(front);
    element.appendChild(back);
    element.appendChild(label);

    element.addEventListener("click", () => {
        selectChamber(id);
    });

    return element;
}

// ============================================================
// Local storage
// ============================================================

function saveDeckToStorage() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(deck)
    );
}


function loadSavedDeck() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        return;
    }

    try {
        const parsed = JSON.parse(saved);

        if (parsed &&
            typeof parsed === "object" &&
            parsed.cards &&
            typeof parsed.cards === "object"
        ) {
            deck = {
                chamber:
                    parsed.chamber &&
                    parsed.chamber.character &&
                    parsed.chamber.id
                        ? parsed.chamber
                        : null,

                cards: parsed.cards
            };
        }
    } catch (error) {
        console.error("Unable to load saved deck.", error);

    }
}


function saveDeck() {
    saveDeckToStorage();
    alert("Deck saved.");
}


function clearDeck() {
    if (!confirm("Are you sure you want to clear the deck?")) {
        return;
    }

    deck = {
        chamber: null,
        cards: {}
    };

    saveDeckToStorage();

    renderChambers();
    renderDeck();
    renderCards();
}

function addCardHoverPreview(image) {
    let hoverTimer = null;
    let preview = null;
    let hovering = false;

    function hidePreview() {
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }

        if (preview) {
            preview.remove();
            preview = null;
        }
    }

    function showPreview() {
        if (!hovering || preview) {
            return;
        }

        preview = document.createElement("img");
        preview.src = image.src;
        preview.className = "card-hover-preview";

        document.body.appendChild(preview);

        const gap = 10;
        const rect = image.getBoundingClientRect();
                
        let left = rect.right + gap;

        // If the preview would extend past the right edge,
        // put it to the left of the card instead.
        if (left + preview.offsetWidth > window.innerWidth) {
            left = rect.left - preview.offsetWidth - gap;
        }

        preview.style.left = `${left}px`;
        preview.style.top =
            `${rect.top - (rect.height - preview.offsetHeight) / 2}px`;
    }

    function startTimer() {
        clearTimeout(hoverTimer);

        hoverTimer = setTimeout(() => {
            hoverTimer = null;
            showPreview();
        }, 50);
    }

    image.addEventListener("mouseenter", () => {
        hovering = true;
        startTimer();
    });

    image.addEventListener("mousemove", () => {
        if (!hovering || preview) {
            return;
        }

        startTimer();
    });

    image.addEventListener("mouseleave", () => {
        hovering = false;
        hidePreview();
    });
}