// ============================================================
// Configuration
// ============================================================

const CARD_DATA_URL = "data/cards.json";
const CHAMBER_DATA_URL = "data/characters.json";

const CARD_IMAGE_PATH = "images/cards/";
const CHAMBER_IMAGE_PATH = "images/chambers/";
const TRAIT_ICON_PATH = "images/icons/traits/";

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
let deckSort = "name";
let deckSortAscending = true;

const deckSectionOpen = {
    STRIKE: true,
    ADVANTAGE: true,
    ALLY: true
};

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
    document
        .querySelectorAll(".deck-sort-button")
        .forEach(button => {
            button.addEventListener("click", () => {
                const sort = button.dataset.sort;

                if (deckSort === sort) {
                    deckSortAscending = !deckSortAscending;
                } else {
                    deckSort = sort;
                    deckSortAscending = true;
                }

                renderDeckCardList();
            });
        });

    document
        .querySelectorAll('input[name="card-type"]')
        .forEach(checkbox => {
            checkbox.checked = selectedTypes.has(checkbox.value);

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selectedTypes.add(checkbox.value);
                } else {
                    selectedTypes.delete(checkbox.value);
                }

                if (deck.chamber) {
                    renderCards();
                }
            });
        });
}


// ============================================================
// Filters
// ============================================================

const FILTER_TYPES = ["STRIKE", "ADVANTAGE", "ALLY"];

let selectedTypes = new Set(FILTER_TYPES);
let selectedTraits = new Set();


function initializeCardFilters() {
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
    traits.add("NONE");

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

                if (deck.chamber) {
                    renderCards();
                }
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${trait}`));
            traitContainer.appendChild(label);
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
    const heading = document.querySelector(".available-panel h2");

    if (!deck.chamber) {
        heading.textContent = "Available Chambers";
        renderAvailableChambers(grid);
        return;
    }

    heading.textContent = "Available Cards";
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
    document.getElementById("deck-header-card-count").textContent = `${count} / 60`;
}

function renderDeckCardList() {
    const element = document.getElementById("deck-cards");
    element.innerHTML = "";

    const cardIds = Object.keys(deck.cards);

    if (cardIds.length === 0) {
        element.innerHTML = "<p>Your deck is empty.</p>";
        return;
    }

    const typeOrder = [
        ["STRIKE", "Strikes"],
        ["ADVANTAGE", "Advantages"],
        ["ALLY", "Allies"]
    ];

    typeOrder.forEach(([type, label]) => {
        const typeCardIds = cardIds.filter(cardId =>
            cards[cardId] && cards[cardId].type === type
        );

        const section = document.createElement("section");
        section.className = "deck-type-section";

        const header = document.createElement("div");
        header.className = "deck-type-header";
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-expanded", deckSectionOpen[type]);

        const arrow = document.createElement("span");
        arrow.className = "deck-type-arrow";
        arrow.textContent = deckSectionOpen[type] ? "▾" : "▸";

        const title = document.createElement("h3");
        const count = typeCardIds.reduce(
            (total, cardId) => total + deck.cards[cardId],
            0
        );
        title.textContent = `${label} — ${count}`;

        header.appendChild(arrow);
        header.appendChild(title);

        const toggleSection = () => {
            deckSectionOpen[type] = !deckSectionOpen[type];
            renderDeckCardList();
        };

        header.addEventListener("click", toggleSection);
        header.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleSection();
            }
        });

        section.appendChild(header);

        if (deckSectionOpen[type]) {
            const sortHeader = document.createElement("div");
            sortHeader.className = "deck-sort-header";

            ["qty", "trait", "name", "cost"].forEach(sort => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "deck-sort-button";
                button.dataset.sort = sort;
                button.textContent = sort === "qty" ? "Qty" :
                    sort === "trait" ? "Trait" :
                    sort === "cost" ? "Cost" : "Name";
                button.addEventListener("click", event => {
                    event.stopPropagation();

                    if (deckSort === sort) {
                        deckSortAscending = !deckSortAscending;
                    } else {
                        deckSort = sort;
                        deckSortAscending = true;
                    }

                    renderDeckCardList();
                });
                sortHeader.appendChild(button);
            });

            section.appendChild(sortHeader);

            const cardList = [...typeCardIds];

            if (deckSort) {
                cardList.sort((cardIdA, cardIdB) => {
                    const cardA = cards[cardIdA];
                    const cardB = cards[cardIdB];
                    let result;

                    if (deckSort === "qty") {
                        result = deck.cards[cardIdA] - deck.cards[cardIdB] ||
                            cardA.name.localeCompare(cardB.name);
                    } else if (deckSort === "cost") {
                        const costA = cardA.cost || {};
                        const costB = cardB.cost || {};
                        result = (costA.g || 0) - (costB.g || 0) ||
                            (costA.y || 0) - (costB.y || 0) ||
                            (costA.r || 0) - (costB.r || 0) ||
                            cardA.name.localeCompare(cardB.name);
                    } else if (deckSort === "trait") {
                        const traitA = cardA.trait || "NONE";
                        const traitB = cardB.trait || "NONE";

                        if (traitA === "NONE" && traitB !== "NONE") {
                            result = -1;
                        } else if (traitA !== "NONE" && traitB === "NONE") {
                            result = 1;
                        } else {
                            result = traitA.localeCompare(traitB) ||
                                cardA.name.localeCompare(cardB.name);
                        }
                    } else {
                        result = cardA.name.localeCompare(cardB.name);
                    }

                    return deckSortAscending ? result : -result;
                });
            }

            cardList.forEach(cardId => {
                const card = cards[cardId];
                const row = document.createElement("div");
                row.className = "deck-card";

                const controls = document.createElement("div");
                controls.className = "quantity-controls";

                const removeButton = document.createElement("button");
                removeButton.type = "button";

                if (deck.cards[cardId] === 1) {
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

                const addButton = document.createElement("button");
                addButton.textContent = "+";
                addButton.type = "button";
                addButton.disabled = deck.cards[cardId] >= MAX_COPIES;
                addButton.addEventListener(
                    "click",
                    () => addCardToDeck(cardId)
                );

                controls.appendChild(removeButton);
                controls.appendChild(quantity);
                controls.appendChild(addButton);

                const trait = document.createElement("div");
                trait.className = "deck-card-trait";

                if (card.trait && card.trait !== "NONE") {
                    const traitIcon = document.createElement("img");
                    traitIcon.src = `${TRAIT_ICON_PATH}${card.trait}.png`;
                    traitIcon.alt = card.trait;
                    trait.appendChild(traitIcon);
                }

                const cost = document.createElement("div");
                cost.className = "deck-card-cost";

                const costComponents = [
                    ["g", "green"],
                    ["y", "yellow"],
                    ["r", "red"]
                ];

                costComponents.forEach(([component, color]) => {
                    if (card.cost && Object.prototype.hasOwnProperty.call(card.cost, component)) {
                        const circle = document.createElement("span");
                        circle.className = `deck-cost-circle deck-cost-${color}`;
                        circle.textContent = card.cost[component];
                        cost.appendChild(circle);
                    }
                });

                const name = document.createElement("div");
                name.className = "deck-card-name";
                name.textContent = card.name;

                addCardHoverPreview(
                    name,
                    `${CARD_IMAGE_PATH}${cardId}.png`
                );

                row.appendChild(controls);
                row.appendChild(trait);
                row.appendChild(name);
                row.appendChild(cost);
                section.appendChild(row);
            });
        }

        element.appendChild(section);
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

    Object.entries(character.chambers)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([chamberId, chamber]) => {
            element.appendChild(
                createChamberChoice(
                    selectedChamberCharacter,
                    chamberId,
                    chamber
                )
            );
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
}

function addCardHoverPreview(element, imageSrc) {
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

    function positionPreview() {
        if (!preview || !hovering) {
            return;
        }

        const gap = 10;
        const rect = element.getBoundingClientRect();

        let left = rect.right + gap;

        if (left + preview.offsetWidth > window.innerWidth - gap) {
            left = rect.left - preview.offsetWidth - gap;
        }

        let top = rect.top +
            (rect.height - preview.offsetHeight) / 2;

        if (top + preview.offsetHeight > window.innerHeight - gap) {
            top = window.innerHeight - preview.offsetHeight - gap;
        }

        if (top < gap) {
            top = gap;
        }

        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
        preview.style.visibility = "visible";
    }

    function showPreview() {
        if (!hovering || preview) {
            return;
        }

        preview = document.createElement("img");
        preview.src = imageSrc;
        preview.className = "card-hover-preview";

        // Keep the preview invisible until its dimensions are known
        // and its position has been calculated.
        preview.style.visibility = "hidden";

        preview.addEventListener("load", () => {
            positionPreview();
        });

        document.body.appendChild(preview);

        // Handles the case where the image is already cached.
        if (preview.complete) {
            positionPreview();
        }
    }

    function startTimer() {
        clearTimeout(hoverTimer);

        hoverTimer = setTimeout(() => {
            hoverTimer = null;
            showPreview();
        }, 50);
    }

    element.addEventListener("mouseenter", () => {
        hovering = true;
        startTimer();
    });

    element.addEventListener("mousemove", () => {
        if (!hovering || preview) {
            return;
        }

        startTimer();
    });

    element.addEventListener("mouseleave", () => {
        hovering = false;
        hidePreview();
    });
}