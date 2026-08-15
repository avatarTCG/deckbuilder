const CHARACTER_DATA_URL = "data/characters.json";
const CHAMBER_IMAGE_PATH = "images/chambers/";
const SELECTED_CHARACTER_KEY = "selected-character";

let characters = {};
let selectedCharacter = null;

localStorage.removeItem("card-game-deck");
localStorage.removeItem("selected-character");

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
    const response = await fetch(CHARACTER_DATA_URL);
    if (!response.ok) {
        throw new Error("Unable to load characters.json");
    }
    characters = await response.json();
}

function renderCharacters() {
    const grid = document.getElementById("character-grid");
    grid.innerHTML = "";

    Object.entries(characters)
        .sort(([, characterA], [, characterB]) =>
            characterA.character.localeCompare(characterB.character) ||
            characterA.name.localeCompare(characterB.name)
        )
        .forEach(([key, character]) => {
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
