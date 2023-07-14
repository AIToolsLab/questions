import * as React from 'react';
import { TextField, ChoiceGroup, DefaultButton } from '@fluentui/react';

import { SERVER_URL } from '../settings';

import Progress from './progress';

export interface AppProps {
    isOfficeInitialized: boolean;
}

export interface Card {
    body: string;
    paragraph: number;
}

const presetPrompts = [
    {
        key: 'Summary: phrases',
        text: 'What are 3 of the most important concepts described by this paragraph? Each concept should be described in 2 or 3 words.',
    },
    {
        key: 'Summary: sentences',
        text: 'What are 3 of the most important concepts described by this paragraph? Each concept should be described in a sentence.',
    },
    {
        key: 'Summary: questions',
        // TODO: Improve this prompt
        text: 'List 2 or 3 questions that the writer was attempting to answer in this paragraph.',
    },
    {
        key: 'Reactions: questions',
        text: 'As a reader, ask the writer 2 or 3 questions about definitions, logical connections, or some needed background information.',
    },
    {
        key: 'Metaphors',
        text: 'List the metaphors that the writer uses in this paragraph.',
    },
];

export default function App({ isOfficeInitialized }: AppProps) {
    const [cards, updateCards] = React.useState<Card[]>([]);
    const [prompt, updatePrompt] = React.useState('');
    const [loading, updateLoading] = React.useState(false);
    const [dict] = React.useState({});

    // Get the current paragraph that the cursor is in
    // Pick the first paragraph if current selection includes multiple paragraphs
    async function getCurrentParagraph(context) {
        let selectedParagraph = context.document.getSelection().paragraphs;
        context.load(selectedParagraph);
        await context.sync();

        return selectedParagraph.items[0];
    }

    // Get the paragraph index by comparing the texts of the paragraphs
    // Assume that there are no paragraphs that have exactly the same text
    function getParagraphIndex(paragraph) {
        return Object.keys(dict).find(key => dict[key].text === paragraph.text) || null;
    }

    // Change the background color of card that has the given cardId
    function changeCardHighlightColor(cardId) {
        const allCards = cards.getElementsByClassName("card");

        allCards.forEach(card => {
            card.style.backgroundColor = card.paragraph === cardId ? "#FFFF00" : "#F0F0F0";     // yellow or grey
        });
    }

    // Detect the cursor location and change the card color as cursor moves
    async function detectParagraphChange(context) {
        let initialParagraph = await getCurrentParagraph(context);
        let initialIndex = getParagraphIndex(initialParagraph);
        changeCardHighlightColor(initialIndex);

        while (true) {
            let currentParagraph = await getCurrentParagraph(context);
            if (initialParagraph.text != currentParagraph.text) {
                let currentIndex = getParagraphIndex(currentParagraph);
                changeCardHighlightColor(currentIndex);
                initialParagraph = currentParagraph;
            }
            // Add a delay between checks (e.g., 1 second) to avoid excessive API calls
            await delay(1000);
        }
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
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

            if (operation == 'highlight')
                target.font.highlightColor = '#FFFF00';
            else if (operation == 'dehighlight')
                target.font.highlightColor = '#FFFFFF';
        });
    }

    async function getReflectionFromServer(paragraph, prompt) {
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

        if (res.error) alert(res); // TODO: need to verify that this works

        return res.reflections;
    }

    async function getReflections() {
        await Word.run(async (context) => {
            let curPrompt = prompt;

            if (curPrompt.length === 0)
                curPrompt =
                    'Using only the text from the user, what are 3 of the most important concepts in this paragraph?';

            const paragraphs = context.document.body.paragraphs;
            paragraphs.load();

            await context.sync();

            updateLoading(true);

            const allReflections = await Promise.all(
                paragraphs.items.map((paragraph) =>
                    getReflectionFromServer(paragraph.text, curPrompt)
                )
            );

            updateLoading(false);

            const curCards = [];

            for (let i = 0; i < paragraphs.items.length; i++) {
                const reflections = allReflections[i];

                // Match the index with the paragraph using a dictionary
                dict[i] = paragraphs.items[i];

                // Create a card for each reflection returned
                for (let j = 0; j < reflections.length; j++) {
                    const reflection = reflections[j];
                    const card = {
                        body: reflection.text_in_HTML_format,
                        paragraph: i,
                    };

                    curCards.push(card);
                }
            }

            updateCards(curCards);

            // Keep detecting the change on paragraph after cards are created
            detectParagraphChange(context);
        });
    }

    if (!isOfficeInitialized || loading) return <Progress message="Loading" />;

    return (
        <div className="ms-welcome">
            <ChoiceGroup
                label="Preset Prompts"
                options={presetPrompts}
                onChange={(e) =>
                    updatePrompt(
                        (e.currentTarget as HTMLInputElement).labels[0]
                            .innerText
                    )
                }
            />

            <TextField
                multiline={true}
                className="prompt-editor"
                label="Custom Prompt"
                resizable={false}
                onChange={(p) => updatePrompt(p.currentTarget.value)}
                value={prompt}
            />

            <div className="button-container">
                <DefaultButton onClick={getReflections}>
                    Get Reflections
                </DefaultButton>
            </div>

            <div className="cards-container">
                {cards.map((card, i) => (
                    <div
                        key={i}
                        className="card-container"
                        onMouseEnter={() =>
                            changeParagraphHighlightColor(
                                card.paragraph,
                                'highlight'
                            )
                        }
                        onMouseLeave={() =>
                            changeParagraphHighlightColor(
                                card.paragraph,
                                'dehighlight'
                            )
                        }
                    >
                        {card.body}
                    </div>
                ))}
            </div>
        </div>
    );
}
