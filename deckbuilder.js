// ============================================================
// Configuration
// ============================================================

const CARD_DATA_URL = "data/cards.json";
const CHAMBER_DATA_URL = "data/chambers.json";

const CARD_IMAGE_PATH = "images/cards/";

const MAX_COPIES = 4;
const MIN_DECK_SIZE = 60;

const STORAGE_KEY = "card-game-deck";


// ============================================================
// Application state
// ============================================================

let cards = {};
let chambers = {};

let deck = {
    chamber: null,

    cards: {}
};


// ============================================================
// Initialization
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    setupEventListeners();

    loadSavedDeck();

    try {

        await loadCardData();
        await loadChamberData();

        populateFilters();

        renderChambers();
        renderCards();
        renderDeck();

    } catch (error) {

        console.error(error);

        document.getElementById("card-grid").innerHTML =
            "<p>Unable to load card data.</p>";

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

    document
        .getElementById("search")
        .addEventListener("input", renderCards);

    document
        .getElementById("type-filter")
        .addEventListener("change", renderCards);

    document
        .getElementById("trait-filter")
        .addEventListener("change", renderCards);

    document
        .getElementById("rarity-filter")
        .addEventListener("change", renderCards);

    document
        .getElementById("clear-deck")
        .addEventListener("click", clearDeck);

    document
        .getElementById("save-deck")
        .addEventListener("click", saveDeck);
}


// ============================================================
// Filters
// ============================================================

function populateFilters() {

    const types = new Set();
    const traits = new Set();
    const rarities = new Set();

    Object.values(cards).forEach(card => {

        if (card.type) {
            types.add(card.type);
        }

        if (card.trait) {
            traits.add(card.trait);
        }

        if (card.rarity) {
            rarities.add(card.rarity);
        }

    });

    populateSelect("type-filter", types);
    populateSelect("trait-filter", traits);
    populateSelect("rarity-filter", rarities);
}


function populateSelect(elementId, values) {

    const select = document.getElementById(elementId);

    [...values]
        .sort()
        .forEach(value => {

            const option = document.createElement("option");

            option.value = value;
            option.textContent = value;

            select.appendChild(option);

        });
}


// ============================================================
// Card browser
// ============================================================

function renderCards() {

    const grid = document.getElementById("card-grid");

    const search =
        document
            .getElementById("search")
            .value
            .trim()
            .toLowerCase();

    const type =
        document.getElementById("type-filter").value;

    const trait =
        document.getElementById("trait-filter").value;

    const rarity =
        document.getElementById("rarity-filter").value;


    grid.innerHTML = "";


    Object.entries(cards)
        .filter(([id, card]) => {

            if (
                search &&
                !card.name.toLowerCase().includes(search) &&
                !id.toLowerCase().includes(search)
            ) {
                return false;
            }

            if (type && card.type !== type) {
                return false;
            }

            if (trait && card.trait !== trait) {
                return false;
            }

            if (rarity && card.rarity !== rarity) {
                return false;
            }

            return true;

        })
        .forEach(([id, card]) => {

            const element = createCardElement(id, card);

            grid.appendChild(element);

        });


    if (grid.children.length === 0) {

        grid.innerHTML =
            "<p>No cards match your filters.</p>";

    }
}


function createCardElement(id, card) {

    const container = document.createElement("div");

    container.className = "card";

    container.title = card.name;


    const image = document.createElement("img");

    image.src =
        `${CARD_IMAGE_PATH}${id}.png`;

    image.alt = card.name;

    image.loading = "lazy";


    image.onerror = () => {

        image.alt = `${card.name} - image not found`;

    };


    container.appendChild(image);


    const quantity = deck.cards[id] || 0;

    if (quantity > 0) {

        const quantityElement =
            document.createElement("div");

        quantityElement.className =
            "card-quantity";

        quantityElement.textContent =
            quantity;

        container.appendChild(quantityElement);

    }


    container.addEventListener("click", () => {

        addCardToDeck(id);

    });


    return container;
}


// ============================================================
// Deck manipulation
// ============================================================

function addCardToDeck(cardId) {

    const currentQuantity =
        deck.cards[cardId] || 0;


    if (currentQuantity >= MAX_COPIES) {

        alert(
            `You can only have ${MAX_COPIES} copies of a card.`
        );

        return;

    }


    deck.cards[cardId] =
        currentQuantity + 1;


    renderDeck();
    renderCards();

    saveDeckToStorage();
}


function removeCardFromDeck(cardId) {

    const currentQuantity =
        deck.cards[cardId] || 0;


    if (currentQuantity <= 1) {

        delete deck.cards[cardId];

    } else {

        deck.cards[cardId] =
            currentQuantity - 1;

    }


    renderDeck();
    renderCards();

    saveDeckToStorage();
}


// ============================================================
// Deck rendering
// ============================================================

function renderDeck() {

    renderDeckCount();
    renderDeckValidation();
    renderDeckList();
}


function getDeckSize() {

    return Object.values(deck.cards)
        .reduce(
            (total, quantity) => total + quantity,
            0
        );
}


function renderDeckCount() {

    const count =
        getDeckSize();

    document.getElementById("deck-count").textContent =
        `${count} card${count === 1 ? "" : "s"}`;
}


function renderDeckValidation() {

    const element =
        document.getElementById("deck-validation");

    const size =
        getDeckSize();

    const messages = [];


    if (!deck.chamber) {

        messages.push("Select a Chamber.");

    }


    if (size < MIN_DECK_SIZE) {

        messages.push(
            `${MIN_DECK_SIZE - size} more cards needed.`
        );

    }


    if (messages.length === 0) {

        element.className =
            "validation-valid";

        element.textContent =
            "✓ Deck is valid.";

    } else {

        element.className =
            "validation-invalid";

        element.textContent =
            messages.join(" ");

    }
}


function renderDeckList() {

    const element =
        document.getElementById("deck-list");

    element.innerHTML = "";


    const cardIds =
        Object.keys(deck.cards);


    if (cardIds.length === 0) {

        element.innerHTML =
            "<p>Your deck is empty.</p>";

        return;

    }


    cardIds
        .sort((a, b) => {

            const nameA =
                cards[a]?.name || a;

            const nameB =
                cards[b]?.name || b;

            return nameA.localeCompare(nameB);

        })
        .forEach(cardId => {

            const card =
                cards[cardId];

            if (!card) {
                return;
            }


            const row =
                document.createElement("div");

            row.className =
                "deck-card";


            const name =
                document.createElement("div");

            name.className =
                "deck-card-name";

            name.textContent =
                card.name;


            const controls =
                document.createElement("div");

            controls.className =
                "quantity-controls";


            const removeButton =
                document.createElement("button");

            removeButton.textContent =
                "−";

            removeButton.addEventListener(
                "click",
                () => removeCardFromDeck(cardId)
            );


            const quantity =
                document.createElement("span");

            quantity.textContent =
                deck.cards[cardId];


            const addButton =
                document.createElement("button");

            addButton.textContent =
                "+";

            addButton.addEventListener(
                "click",
                () => addCardToDeck(cardId)
            );


            controls.appendChild(removeButton);
            controls.appendChild(quantity);
            controls.appendChild(addButton);


            row.appendChild(name);
            row.appendChild(controls);


            element.appendChild(row);

        });
}


// ============================================================
// Chambers
// ============================================================

function renderChambers() {

    const element =
        document.getElementById("chamber-selector");

    element.innerHTML = "";


    Object.entries(chambers)
        .forEach(([characterKey, chamber]) => {

            const characterSection =
                document.createElement("div");

            const title =
                document.createElement("h3");

            title.textContent =
                chamber.name;

            characterSection.appendChild(title);


            Object.entries(chamber.chambers)
                .forEach(([id, chamberCard]) => {

                    const button =
                        document.createElement("button");

                    button.className =
                        "chamber-button";

                    button.textContent =
                        id;


                    if (
                        deck.chamber &&
                        deck.chamber.character === characterKey &&
                        deck.chamber.id === id
                    ) {

                        button.classList.add("selected");

                    }


                    button.addEventListener(
                        "click",
                        () => {
                            selectChamber(
                                characterKey,
                                id
                            );
                        }
                    );


                    characterSection.appendChild(button);

                });


            element.appendChild(characterSection);

        });


    renderSelectedChamber();
}


function selectChamber(characterKey, chamberId) {

    deck.chamber = {
        character: characterKey,
        id: chamberId
    };


    renderChambers();
    renderDeck();

    saveDeckToStorage();
}


function renderSelectedChamber() {

    const element =
        document.getElementById("selected-chamber");

    element.innerHTML = "";


    if (!deck.chamber) {
        return;
    }


    const character =
        chambers[deck.chamber.character];


    const chamberCard =
        character.chambers[deck.chamber.id];


    const container =
        document.createElement("div");

    container.className =
        "selected-chamber-info";


    const title =
        document.createElement("h3");

    title.textContent =
        `${character.name} - ${deck.chamber.id}`;


    container.appendChild(title);


    const preview =
        document.createElement("div");

    preview.className =
        "chamber-preview";


    preview.appendChild(
        createChamberSide(
            deck.chamber.character,
            chamberCard.front,
            "Front"
        )
    );


    preview.appendChild(
        createChamberSide(
            deck.chamber.character,
            chamberCard.back,
            "Back"
        )
    );


    container.appendChild(preview);

    element.appendChild(container);
}

function createChamberSide(
    characterKey,
    abilityName,
    bottomName
) {

    const side =
        document.createElement("div");

    side.className =
        "chamber-side";


    const topImage =
        document.createElement("img");

    topImage.src =
        `${CHAMBER_IMAGE_PATH}${characterKey}/${abilityName}.png`;

    topImage.alt =
        abilityName;


    const bottomImage =
        document.createElement("img");

    bottomImage.src =
        `${CHAMBER_IMAGE_PATH}${characterKey}/${bottomName}.png`;

    bottomImage.alt =
        bottomName;


    side.appendChild(topImage);
    side.appendChild(bottomImage);


    return side;
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

    const saved =
        localStorage.getItem(STORAGE_KEY);


    if (!saved) {
        return;
    }


    try {
        const parsed =
            JSON.parse(saved);

        if (
            parsed &&
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

        console.error(
            "Unable to load saved deck.",
            error
        );

    }
}


function saveDeck() {

    saveDeckToStorage();

    alert("Deck saved.");
}


function clearDeck() {

    if (
        !confirm(
            "Are you sure you want to clear the deck?"
        )
    ) {
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