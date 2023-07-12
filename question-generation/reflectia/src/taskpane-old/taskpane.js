
// Function to create a new card element
// Pass in the index of the paragraph and the paragraph object
function createCard(index, paragraph) {
    const card = document.createElement('div');

    card.className = 'card';
    card.id = index;
    card.onmouseenter = onMouseEnterEvent;
    card.onmouseleave = onMouseLeaveEvent;

    createParagraph(card, paragraph);
    return card;
}

// Define the event handler for onmouseover
async function onMouseEnterEvent(event) {
    changeParagraphHighlightColor(this.id, 'highlight');
}

// Define the event handler for onmouseleave
async function onMouseLeaveEvent(event) {
    changeParagraphHighlightColor(this.id, 'dehighlight');
}

// Change the highlight color of the selected paragraph
async function changeParagraphHighlightColor(paragraphId, operation) {
    await Word.run(async (context) => {
        // Load the document as a ParagraphCollection
        const paragraphs = context.document.body.paragraphs;
        paragraphs.load();
        await context.sync();

        // Highlight or dehighlight the paragraph
        const target = paragraphs.items[paragraphId];
        target.load('font');
        await context.sync();

        if (operation == 'highlight') {
            target.font.highlightColor = '#FFFF00';
        } else if (operation == 'dehighlight') {
            target.font.highlightColor = '#FFFFFF';
        }
    });
}

async function getReflections(paragraph, prompt) {
    const data = {
        paragraph,
        prompt,
    };

    const req = await fetch(`${SERVER_URL}/reflections`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const res = await req.json();

    if (res.error) alert(res);

    return res.reflections;
}

async function getCurrentParagraph(context) {
    let selectedParagraphs = context.document.getSelection().paragraphs;
    context.load(selectedParagraphs);
    await context.sync();

    // A selection can span multiple paragraphs, but we only want the first one
    return selectedParagraphs.items[0];
}

async function detectParagraphChange() {
    let initialParagraph = await getCurrentParagraph()();

    while (true) {
        let currentParagraph = await getCurrentParagraph();
        if (initialParagraph.text != currentParagraph.text) {
            try {
                console.log('paragraph changed');
            } catch (error) {
                console.log(error);
            }

            initialParagraph = currentParagraph;
        }

        // Add a delay between checks (e.g., 1 second) to avoid excessive API calls
        await delay(1000);
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    await Word.run(async (context) => {
        let prompt = document.getElementById('prompt').value;

        if (prompt.length === 0)
            prompt =
                'Using only the text from the user, what are 3 of the most important concepts in this paragraph?';

        // FIXME: Get the prompt from the user.

        const paragraphs = context.document.body.paragraphs;

        paragraphs.load();
        await context.sync();

        let cardContainer = document.getElementById('card-container');
        cardContainer.innerHTML = 'Loading...';
        let cardsFragment = document.createDocumentFragment();

        const allReflections = await Promise.all(
            paragraphs.items.map((paragraph) =>
                getReflections(paragraph.text, prompt)
            )
        );

        // clear the loading message
        cardContainer.innerHTML = '';

        // Create a card for each paragraph
        console.log(allReflections);
        for (let i = 0; i < paragraphs.items.length; i++) {
            const paragraph = paragraphs.items[i];
            const reflections = allReflections[i];
            // Create a card for each reflection returned
            for (let j = 0; j < reflections.length; j++) {
                const reflection = reflections[j];
                const card = createCard(i, reflection.text_in_HTML_format);
                cardsFragment.appendChild(card);
            }
        }
        cardContainer.appendChild(cardsFragment);
    });
}
