const CHAMBER_DATA_URL = "data/chambers.json";
const CHAMBER_IMAGE_PATH = "images/chambers/";
const SELECTED_CHARACTER_KEY = "selected-character";

let chambers = {};
let selectedCharacter = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadChamberData();
        renderCharacters();
    } catch (error) {
        console.error(error);
        document.getElementById("character-grid").innerHTML = "<p>Unable to load character data.</p>";
    }
});

async function loadChamberData() {
    const response = await fetch(CHAMBER_DATA_URL);
    if (!response.ok) {
        throw new Error("Unable to load chambers.json");
    }
    chambers = await response.json();
}

function renderCharacters() {
    const grid = document.getElementById("character-grid");
    grid.innerHTML = "";

    Object.entries(chambers).forEach(([key, character]) => {
        const choice = document.createElement("button");
        choice.className = "character-choice";
        choice.type = "button";

        const image = document.createElement("img");
        image.src = `${CHAMBER_IMAGE_PATH}${key}/Front.png`;
        image.alt = character.name;

        choice.appendChild(image);
        choice.addEventListener("click", () => {
            localStorage.setItem(SELECTED_CHARACTER_KEY, key);
            window.location.href = "deckbuilder.html";
        });

        grid.appendChild(choice);
    });
}
