# Issues

- Need Error handling 

## Prompts need improvement

1. Fix ChatGPT prompt so that it is confined to text only provided by the user
2. Find the prompt kca had written for question summaries

Overall: try the prompt evaluation tool https://github.com/typpo/promptfoo

We can test for hallucination by asserting that the response *doesn't* include some things that we know are not in the text.

Don't bother asking about paragraphs that are too short (3 sentences or less?).

Rate limiting on the server side.

Only request reflections on parapgrahs right around the current one.

- Put back in        "phrase_from_paragraph": "..."
- Ensure that it actually matches a phrase from the parapgraph
  - fuzzy match w/ regex?? (Ray)



## Card display

- Would be nice to show more than just the current paragraph (maybe the previous and next paragraph as well)
- Response formatting: lists should show up as lists (Markdown?? Ask for a JSON response??)
  - See the OpenAI "function calling" example for how to specify the response format
  - Ask for the response in HTML? (Cheating...?)
- Affordances
  - Thumbs up and thumbs down buttons?? 
    - Thumbs down regenerates? bust the cache somehow
      - just log the thumbs-down?
    - Thumbs up saves to a comment? log this somehow too


## Two-way mapping

- When you hover over a card, highlight the corresponding text in the document. (At least the corresponding paragraph.)
- When you click on a paragraph, highlight the corresponding card. (Sophia has code that might work already.)

## Controls

- More preset prompts
- Clearer way to edit the prompt?
- Use FabricUI styles so it matches Word?
- Maybe request multiple responses? Pick best of...?



Alternative highlighting approach:


Rewrite the following paragraph, put square brackets around the phrases that are relevant to "...".

